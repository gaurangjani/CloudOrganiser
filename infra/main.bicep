// Azure Bicep – Cloud Organiser infrastructure
// Provisions:
//   - Azure Container Registry (ACR)
//   - Azure Database for PostgreSQL Flexible Server
//   - Log Analytics workspace
//   - Azure Container Apps environment
//   - Backend Container App
//   - Frontend Container App
//
// Deploy with:
//   az group create --name <rg> --location <location>
//   az deployment group create \
//     --resource-group <rg> \
//     --template-file infra/main.bicep \
//     --parameters @infra/main.bicepparam

@description('Name prefix used for all resources (max 12 chars, lowercase alphanumeric).')
@maxLength(12)
param namePrefix string = 'cloudorg'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Container image tag to deploy (e.g. git SHA).')
param imageTag string = 'latest'

@description('PostgreSQL administrator login name.')
param dbAdminLogin string = 'pgadmin'

@description('PostgreSQL administrator password.')
@secure()
param dbAdminPassword string

@description('Session secret for Express sessions.')
@secure()
param sessionSecret string

@description('AES-256 token encryption key (min 32 chars).')
@secure()
param tokenEncryptionKey string

@description('Google OAuth client ID (leave blank if unused).')
param googleClientId string = ''

@description('Google OAuth client secret (leave blank if unused).')
@secure()
param googleClientSecret string = ''

@description('Microsoft OAuth client ID (leave blank if unused).')
param microsoftClientId string = ''

@description('Microsoft OAuth client secret (leave blank if unused).')
@secure()
param microsoftClientSecret string = ''

@description('AI provider (local | openai | azure-openai).')
@allowed(['local', 'openai', 'azure-openai'])
param aiProvider string = 'local'

@description('AI provider API key (leave blank if aiProvider is local).')
@secure()
param aiApiKey string = ''

@description('Azure OpenAI endpoint (required when aiProvider is azure-openai).')
param aiEndpoint string = ''

// ── Derived names ───────────────────────────────────────────────────────────
var acrName = '${namePrefix}acr'
var dbServerName = '${namePrefix}-db'
var logAnalyticsName = '${namePrefix}-logs'
var containerAppsEnvName = '${namePrefix}-env'
var backendAppName = '${namePrefix}-backend'
var frontendAppName = '${namePrefix}-frontend'
var backendImage = '${acr.properties.loginServer}/cloud-organiser-backend:${imageTag}'
var frontendImage = '${acr.properties.loginServer}/cloud-organiser-frontend:${imageTag}'
var dbUrl = 'postgresql://${dbAdminLogin}:${dbAdminPassword}@${dbServer.properties.fullyQualifiedDomainName}:5432/cloudorganiser?sslmode=require'

// ── Azure Container Registry ────────────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// ── PostgreSQL Flexible Server ───────────────────────────────────────────────
resource dbServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: dbServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: dbAdminLogin
    administratorLoginPassword: dbAdminPassword
    version: '16'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
}

resource dbFirewallAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: dbServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: dbServer
  name: 'cloudorganiser'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ── Log Analytics workspace ──────────────────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ── Container Apps environment ───────────────────────────────────────────────
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppsEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ── Backend Container App ────────────────────────────────────────────────────
resource backendApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: backendAppName
  location: location
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password', value: acr.listCredentials().passwords[0].value }
        { name: 'database-url', value: dbUrl }
        { name: 'session-secret', value: sessionSecret }
        { name: 'token-encryption-key', value: tokenEncryptionKey }
        { name: 'google-client-id', value: googleClientId }
        { name: 'google-client-secret', value: googleClientSecret }
        { name: 'microsoft-client-id', value: microsoftClientId }
        { name: 'microsoft-client-secret', value: microsoftClientSecret }
        { name: 'ai-api-key', value: aiApiKey }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'SESSION_SECRET', secretRef: 'session-secret' }
            { name: 'TOKEN_ENCRYPTION_KEY', secretRef: 'token-encryption-key' }
            { name: 'GOOGLE_CLIENT_ID', secretRef: 'google-client-id' }
            { name: 'GOOGLE_CLIENT_SECRET', secretRef: 'google-client-secret' }
            { name: 'MICROSOFT_CLIENT_ID', secretRef: 'microsoft-client-id' }
            { name: 'MICROSOFT_CLIENT_SECRET', secretRef: 'microsoft-client-secret' }
            { name: 'AI_PROVIDER', value: aiProvider }
            { name: 'AI_API_KEY', secretRef: 'ai-api-key' }
            { name: 'AI_ENDPOINT', value: aiEndpoint }
            { name: 'CORS_ORIGIN', value: 'https://${frontendAppName}.${containerAppsEnv.properties.defaultDomain}' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/v1/health/live'
                port: 3000
              }
              initialDelaySeconds: 30
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/v1/health/ready'
                port: 3000
              }
              initialDelaySeconds: 30
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// ── Frontend Container App ───────────────────────────────────────────────────
resource frontendApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: frontendAppName
  location: location
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'http'
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password', value: acr.listCredentials().passwords[0].value }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: frontendImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: 80
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────
@description('Azure Container Registry login server.')
output acrLoginServer string = acr.properties.loginServer

@description('Backend application FQDN.')
output backendFqdn string = backendApp.properties.configuration.ingress.fqdn

@description('Frontend application FQDN.')
output frontendFqdn string = frontendApp.properties.configuration.ingress.fqdn

@description('PostgreSQL server FQDN.')
output dbServerFqdn string = dbServer.properties.fullyQualifiedDomainName
