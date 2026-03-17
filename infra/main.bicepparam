// Parameter file for infra/main.bicep
// Copy this file and fill in the values for your environment.
// Reference: https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/parameter-files

using './main.bicep'

// Resource naming prefix (max 12 chars, lowercase alphanumeric)
param namePrefix = 'cloudorg'

// Azure region
param location = 'eastus'

// Container image tag (set to the git SHA on deploy, e.g. via --parameters imageTag=$GITHUB_SHA)
param imageTag = 'latest'

// PostgreSQL admin credentials – CHANGE THESE
param dbAdminLogin = 'pgadmin'
param dbAdminPassword = '<CHANGE_ME>'

// Required secrets – CHANGE THESE before deploying
param sessionSecret = '<CHANGE_ME>'         // random string, at least 32 chars
param tokenEncryptionKey = '<CHANGE_ME>'    // random string, at least 32 chars

// Google OAuth (optional – leave empty if not using Google login)
param googleClientId = ''
param googleClientSecret = ''

// Microsoft OAuth (optional – leave empty if not using Microsoft login)
param microsoftClientId = ''
param microsoftClientSecret = ''

// AI provider ('local' | 'openai' | 'azure-openai')
param aiProvider = 'local'
param aiApiKey = ''
param aiEndpoint = ''
