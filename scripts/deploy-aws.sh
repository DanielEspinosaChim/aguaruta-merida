#!/usr/bin/env bash
# Despliega AguaRuta en AWS (capa gratuita): S3 + DynamoDB + Lambda + API Gateway (HTTP API) + Amplify Hosting.
# Requiere AWS CLI v2 y sesión activa: aws login --profile aguaruta
# Idempotente: si un recurso ya existe, lo reutiliza.
set -euo pipefail

PROFILE="${AWS_PROFILE:-aguaruta}"
REGION="${AWS_REGION:-us-east-2}"  # la SCP del hackathon solo permite us-east-2
AWS="aws --profile $PROFILE --region $REGION"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ACCOUNT=$($AWS sts get-caller-identity --query Account --output text)
SNAP_BUCKET="aguaruta-data-$ACCOUNT"
PHOTO_BUCKET="aguaruta-photos-$ACCOUNT"
TABLE="Reports"
ROLE="aguaruta-api-role"
FN="aguaruta-api"
API_NAME="aguaruta-api"
APP_NAME="aguaruta-web"
echo "Cuenta $ACCOUNT · región $REGION"

# ---------- S3 ----------
for B in "$SNAP_BUCKET" "$PHOTO_BUCKET"; do
  if ! $AWS s3api head-bucket --bucket "$B" 2>/dev/null; then
    if [ "$REGION" = "us-east-1" ]; then
      $AWS s3api create-bucket --bucket "$B" >/dev/null
    else
      $AWS s3api create-bucket --bucket "$B" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
    fi
    echo "bucket $B creado"
  fi
  $AWS s3api put-public-access-block --bucket "$B" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
done
$AWS s3api put-bucket-cors --bucket "$PHOTO_BUCKET" --cors-configuration \
  '{"CORSRules":[{"AllowedMethods":["PUT"],"AllowedOrigins":["*"],"AllowedHeaders":["Content-Type"],"MaxAgeSeconds":300}]}'
$AWS s3 cp data/segments.json "s3://$SNAP_BUCKET/segments.json" --only-show-errors
$AWS s3 sync data/snapshots "s3://$SNAP_BUCKET/snapshots" --only-show-errors --delete
echo "snapshots subidos a s3://$SNAP_BUCKET"

# ---------- DynamoDB ----------
if ! $AWS dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
  $AWS dynamodb create-table --table-name "$TABLE" \
    --attribute-definitions AttributeName=reportId,AttributeType=S \
    --key-schema AttributeName=reportId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST >/dev/null
  $AWS dynamodb wait table-exists --table-name "$TABLE"
  $AWS dynamodb update-time-to-live --table-name "$TABLE" \
    --time-to-live-specification Enabled=true,AttributeName=expiresAt >/dev/null
  echo "tabla $TABLE creada"
fi

# ---------- IAM (mínimo privilegio) ----------
if ! $AWS iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  $AWS iam create-role --role-name "$ROLE" --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  $AWS iam attach-role-policy --role-name "$ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  echo "rol $ROLE creado; esperando propagación"
  sleep 10
fi
$AWS iam put-role-policy --role-name "$ROLE" --policy-name aguaruta-min --policy-document "{
  \"Version\":\"2012-10-17\",\"Statement\":[
    {\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\"],\"Resource\":\"arn:aws:s3:::$SNAP_BUCKET/*\"},
    {\"Effect\":\"Allow\",\"Action\":[\"s3:ListBucket\"],\"Resource\":\"arn:aws:s3:::$SNAP_BUCKET\"},
    {\"Effect\":\"Allow\",\"Action\":[\"s3:PutObject\",\"s3:GetObject\"],\"Resource\":\"arn:aws:s3:::$PHOTO_BUCKET/reports-photos/*\"},
    {\"Effect\":\"Allow\",\"Action\":[\"dynamodb:PutItem\",\"dynamodb:Scan\"],\"Resource\":\"arn:aws:dynamodb:$REGION:$ACCOUNT:table/$TABLE\"}
  ]}"
ROLE_ARN=$($AWS iam get-role --role-name "$ROLE" --query Role.Arn --output text)

# ---------- Lambda ----------
( cd api && npm run bundle )
python -c "import zipfile;z=zipfile.ZipFile('api/lambda.zip','w',zipfile.ZIP_DEFLATED);z.write('api/dist/index.mjs','index.mjs');z.close()"
ENV_VARS="Variables={SNAPSHOT_BUCKET=$SNAP_BUCKET,PHOTOS_BUCKET=$PHOTO_BUCKET,REPORTS_TABLE=$TABLE}"
if $AWS lambda get-function --function-name "$FN" >/dev/null 2>&1; then
  $AWS lambda update-function-code --function-name "$FN" --zip-file fileb://api/lambda.zip >/dev/null
  $AWS lambda wait function-updated --function-name "$FN"
  $AWS lambda update-function-configuration --function-name "$FN" --environment "$ENV_VARS" >/dev/null
else
  $AWS lambda create-function --function-name "$FN" --runtime nodejs20.x --handler index.handler \
    --role "$ROLE_ARN" --zip-file fileb://api/lambda.zip --timeout 15 --memory-size 512 \
    --environment "$ENV_VARS" >/dev/null
fi
$AWS lambda wait function-active-v2 --function-name "$FN"
FN_ARN=$($AWS lambda get-function --function-name "$FN" --query Configuration.FunctionArn --output text)
echo "lambda $FN lista"

# ---------- API Gateway (HTTP API, quick create) ----------
API_ID=$($AWS apigatewayv2 get-apis --query "Items[?Name=='$API_NAME'].ApiId | [0]" --output text)
if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  API_ID=$($AWS apigatewayv2 create-api --name "$API_NAME" --protocol-type HTTP --target "$FN_ARN" \
    --cors-configuration AllowOrigins='*',AllowMethods=GET,POST,OPTIONS,AllowHeaders=content-type \
    --query ApiId --output text)
  $AWS lambda add-permission --function-name "$FN" --statement-id apigw-invoke \
    --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$API_ID/*" >/dev/null
fi
API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/v1"
echo "API: $API_URL"
curl -fsS -o /dev/null -w "risk/segments → HTTP %{http_code}\n" "$API_URL/risk/segments?bbox=-89.64,20.95,-89.60,20.99&asOf=2026-05-29T20:00:00Z"

# ---------- Amplify Hosting (deploy manual de dist/) ----------
( cd web && VITE_API_BASE_URL="$API_URL" npm run build )
# zip con '/' (Compress-Archive de PowerShell 5.1 usa '\' y Amplify devuelve 404 en assets/)
python -c "import os,zipfile;z=zipfile.ZipFile('web/web.zip','w',zipfile.ZIP_DEFLATED);[z.write(os.path.join(r,f),os.path.relpath(os.path.join(r,f),'web/dist').replace(os.sep,'/')) for r,_,fs in os.walk('web/dist') for f in fs];z.close()"
APP_ID=$($AWS amplify list-apps --query "apps[?name=='$APP_NAME'].appId | [0]" --output text)
if [ "$APP_ID" = "None" ] || [ -z "$APP_ID" ]; then
  APP_ID=$($AWS amplify create-app --name "$APP_NAME" --query app.appId --output text)
  $AWS amplify create-branch --app-id "$APP_ID" --branch-name main >/dev/null
fi
APP_ID=$(echo "$APP_ID" | tr -d '\r')
for J in $($AWS amplify list-jobs --app-id "$APP_ID" --branch-name main \
  --query "jobSummaries[?status=='PENDING'].jobId" --output text | tr -d '\r'); do
  $AWS amplify stop-job --app-id "$APP_ID" --branch-name main --job-id "$J" >/dev/null
done
read -r JOB_ID UPLOAD_URL < <($AWS amplify create-deployment --app-id "$APP_ID" --branch-name main \
  --query "[jobId,zipUploadUrl]" --output text | tr -d '\r')
curl -fsS -X PUT -H "Content-Type: application/zip" --upload-file web/web.zip "$UPLOAD_URL"
$AWS amplify start-deployment --app-id "$APP_ID" --branch-name main --job-id "$JOB_ID" >/dev/null
echo "Web: https://main.$APP_ID.amplifyapp.com"
