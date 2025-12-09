# Azure Credentials Secret Format

## GitHub Secret: AZURE_CREDENTIALS

Du må opprette ein GitHub Secret kalla `AZURE_CREDENTIALS` med følgjande JSON-format:

```json
{
  "clientId": "YOUR_APP_ID",
  "clientSecret": "YOUR_CLIENT_SECRET", 
  "subscriptionId": "YOUR_SUBSCRIPTION_ID",
  "tenantId": "YOUR_TENANT_ID"
}
```

## Korleis få verdiane:

### clientId
Dette er `AZURE_GITHUB_ACCESS_APP_ID` frå Variables

### clientSecret
Client secret du opprett i Azure Portal:
1. Azure Active Directory → App registrations
2. Finn `github-actions-mimir`
3. Certificates & secrets → New client secret
4. Kopier **Value**

### subscriptionId
Dette er `AZURE_GITHUB_ACCESS_SUB_ID` frå Variables

### tenantId
Dette er `AZURE_GITHUB_ACCESS_TENANT_ID` frå Variables

## Steg-for-steg:

1. **Hent verdiane:**
   - Gå til GitHub → Settings → Secrets and variables → Actions → Variables
   - Noter ned `AZURE_GITHUB_ACCESS_APP_ID`, `AZURE_GITHUB_ACCESS_SUB_ID`, `AZURE_GITHUB_ACCESS_TENANT_ID`
   
2. **Opprett client secret i Azure Portal**

3. **Lag JSON-en:**
   ```json
   {
     "clientId": "<AZURE_GITHUB_ACCESS_APP_ID frå Variables>",
     "clientSecret": "<Secret du nettopp laga>", 
     "subscriptionId": "<AZURE_GITHUB_ACCESS_SUB_ID frå Variables>",
     "tenantId": "<AZURE_GITHUB_ACCESS_TENANT_ID frå Variables>"
   }
   ```

4. **Legg til i GitHub:**
   - Gå til GitHub → Settings → Secrets and variables → Actions → Secrets
   - New repository secret
   - Name: `AZURE_CREDENTIALS`
   - Value: (JSON-en frå steg 3)
   - Add secret

## Døme:

```json
{
  "clientId": "12345678-1234-1234-1234-123456789012",
  "clientSecret": "abc123~DEF456_ghi789", 
  "subscriptionId": "87654321-4321-4321-4321-210987654321",
  "tenantId": "11111111-2222-3333-4444-555555555555"
}
```

**VIKTIG:** Dette er berre eit døme! Bruk dine eigne verdiar!

