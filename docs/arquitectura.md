# Arquitectura — AguaRuta Mérida

```mermaid
flowchart LR
  subgraph Usuario
    WEB["SPA React + MapLibre<br/>(AWS Amplify Hosting)"]
  end

  subgraph AWS["AWS · us-east-1"]
    APIGW["Amazon API Gateway<br/>HTTP API /v1"]
    LAMBDA["AWS Lambda<br/>api (router)"]
    S3S[("Amazon S3<br/>segments.json + snapshots/")]
    S3F[("Amazon S3<br/>reports-photos/ (privado)")]
    DDB[("Amazon DynamoDB<br/>Reports · TTL 24 h")]
    LOC["Amazon Location Service<br/>mapa base + CalculateRoutes"]
    IAM["IAM rol mínimo<br/>de la Lambda"]
  end

  DEV["Script build-replay<br/>(laptop, perfil aguaruta)"]

  WEB -->|HTTPS JSON /v1| APIGW --> LAMBDA
  WEB -->|PUT foto con URL prefirmada 5 min| S3F
  WEB -->|tiles con API key| LOC
  LAMBDA -->|GetObject| S3S
  LAMBDA -->|PutItem / Scan| DDB
  LAMBDA -->|firma PutObject| S3F
  LAMBDA -->|CalculateRoutes + Avoid.Areas| LOC
  IAM -. permisos .-> LAMBDA
  DEV -->|PutObject snapshots| S3S
```

| Servicio | Uso |
|---|---|
| AWS Amplify Hosting | Sirve la SPA |
| Amazon API Gateway (HTTP API) | Entrada `/v1` con CORS |
| AWS Lambda | Router `api`: riesgo, reportes, rutas |
| Amazon S3 | Segmentos, snapshots del replay, fotos (privado) |
| Amazon DynamoDB | Tabla `Reports` con TTL de 24 h |
| Amazon Location Service | Mapa base y `CalculateRoutes` con áreas a evitar |
| AWS IAM | Rol de mínimo privilegio de la Lambda |

En local la misma Lambda corre con `api/src/local-server.ts`: snapshots desde disco, reportes en memoria y ruteo con `LocalGraphRoutingProvider` (Dijkstra sobre los tramos).
