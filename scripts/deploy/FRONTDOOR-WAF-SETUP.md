# Azure Front Door Premium + WAF Setup Guide for Mimir

> **Purpose:** Protect Mimir from vulnerability scanning, bot attacks, and DDoS by placing Azure Front Door Premium with Web Application Firewall (WAF) in front of the App Service.
>
> **Why this is needed:** Analysis of production logs (Feb 12–16, 2026) showed that **95.8% of all failed requests (958 of 1,000) were malicious vulnerability probes** — automated scanners probing for PHP, CGI, path traversal exploits, `.env` files, admin panels, and more. The App Service was directly exposed to the internet with no protection layer.

---

## Architecture

```
BEFORE:
  Internet → mimir.vlfk.no → App Service (directly exposed)

AFTER:
  Internet → mimir.vlfk.no (DNS → Front Door) → WAF rules → App Service (locked to Front Door only)
```

**What Azure Front Door Premium provides:**

| Capability | Description |
|-----------|-------------|
| WAF (OWASP rules) | Blocks SQL injection, XSS, path traversal, and other OWASP Top 10 attacks |
| Bot Protection | Detects and blocks automated scanners and scrapers |
| DDoS Protection | L3/L4 DDoS protection built-in at the edge |
| CDN | Caches static assets at edge nodes for faster page loads |
| Origin Locking | App Service only accepts traffic through Front Door |
| SSL Termination | Offloads TLS processing from App Service |
| Health Probes | Automatic detection of backend failures |

---

## Option A: Deploy via Bicep (Infrastructure as Code)

The `main.bicep` template includes Front Door + WAF resources controlled by the `deployFrontDoor` parameter.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `deployFrontDoor` | bool | `false` | Set to `true` to deploy Front Door Premium + WAF |
| `frontDoorCustomDomain` | string | `''` | Custom domain (e.g., `mimir.vlfk.no`). Optional — can be added later |
| `frontDoorId` | string | `''` | Front Door instance ID for origin locking. Get this from the first deployment's output, then redeploy |

### Deploy with PowerShell (two-step process)

**Step 1: Deploy Front Door (without origin locking)**

```powershell
az deployment group create `
  --resource-group RG-SK-Copilot-NPI `
  --template-file main.bicep `
  --parameters deployFrontDoor=true `
  --parameters name=copichat
```

The output will include `frontDoorInstanceId` (a GUID). Copy this value.

**Step 2: Redeploy with origin locking**

```powershell
az deployment group create `
  --resource-group RG-SK-Copilot-NPI `
  --template-file main.bicep `
  --parameters deployFrontDoor=true `
  --parameters frontDoorId={FRONT_DOOR_INSTANCE_ID_FROM_STEP_1} `
  --parameters name=copichat
```

This locks the App Service so it only accepts traffic from your specific Front Door instance.

> **Why two steps?** The Front Door must exist before we can reference its unique ID in the App Service access restrictions. The first deployment creates Front Door and outputs the ID. The second deployment uses that ID to lock the App Service.

### What the Bicep template creates

1. **WAF Policy** (`waf{uniqueName}`) — Premium tier, Prevention mode, with:
   - Microsoft Default Rule Set 2.1 (OWASP protection)
   - Microsoft Bot Manager Rule Set 1.1
2. **Front Door Profile** (`afd-{uniqueName}`) — Premium tier
3. **Endpoint** (`mimir`) — Creates `mimir-{hash}.z01.azurefd.net`
4. **Origin Group** (`mimir-backend`) — Health probes to `/healthz` every 30s, session affinity enabled
5. **Origin** (`mimir-appservice`) — Points to the App Service, HTTPS only
6. **Route** (`mimir-route`) — `/*` pattern, HTTPS only, HTTP-to-HTTPS redirect
7. **Security Policy** (`waf-mimir`) — Associates WAF policy with the endpoint
8. **Access Restrictions** — Locks App Service to only accept traffic from Front Door (via service tag + `X-Azure-FDID` header)

---

## Option B: Deploy via Azure Portal (Manual)

### Prerequisites

1. **Register the `Microsoft.Cdn` resource provider** for your subscription:
   - Go to **Subscription** > **Resource providers** > Search `Microsoft.Cdn` > Click **Register**
   - Wait 1–2 minutes for registration to complete

### Step 1: Create Front Door Profile

1. Go to **Azure Portal** > **Create a resource** > Search **Front Door and CDN profiles**
2. Select **Azure Front Door** > **Custom create**
3. Fill in the **Basics** tab:

| Field | Value |
|-------|-------|
| Subscription | `sub-ikt-ki` (or your subscription) |
| Resource group | `RG-SK-Copilot-NPI` (same as App Service) |
| Name | `AFD-mimir` |
| Tier | **Premium** (Security optimized) — MUST be Premium for WAF |

4. Skip the **Secrets** tab

### Step 2: Configure Endpoint

1. Go to the **Endpoint** tab
2. Click **+ Add an endpoint**
3. Enter name: `mimir`
4. Click **Add**

### Step 3: Add a Route + Origin Group

1. Click **+ Add a route** on the endpoint
2. Fill in the route:

| Field | Value |
|-------|-------|
| Name | `mimir-route` |
| Domains | Select the endpoint you created |
| Patterns to match | `/*` |
| Accepted protocols | **HTTPS only** |
| Redirect | **Enable** HTTP to HTTPS redirect |
| Forwarding protocol | **HTTPS only** |
| Caching | Disabled |

3. For **Origin group**, click **Add a new origin group**:

| Field | Value |
|-------|-------|
| Name | `mimir-backend` |
| Session affinity | **Enabled** (required for SignalR/WebSocket) |

4. Click **+ Add an origin** in the origin group:

| Field | Value |
|-------|-------|
| Name | `mimir-appservice` |
| Origin type | **App services** |
| Host name | `app-copichat-4kt5uxo2hrzri-webapi.azurewebsites.net` |
| Origin host header | (auto-filled, same as host name) |
| Certificate validation | Enabled |
| HTTP port | 80 |
| HTTPS port | 443 |
| Priority | 1 |
| Weight | 1000 |

5. Configure **Health probes** in the origin group:

| Field | Value |
|-------|-------|
| Status | **Enable health probes** |
| Path | `/healthz` |
| Protocol | **HTTPS** |
| Probe method | HEAD |
| Interval | **30** seconds |

6. Load balancing defaults are fine (4/3/50ms)
7. Click **Add** for origin group, then **Add** for route

### Step 4: Add WAF Security Policy

1. On the Endpoint tab, click **+ Add a policy** under "Associated security policies"
2. Fill in:

| Field | Value |
|-------|-------|
| Name | `waf-mimir` |
| Domains | Select the endpoint |
| WAF Policy | Click **Create New** |

3. In the WAF policy creation:

| Field | Value |
|-------|-------|
| Name | `wafmimir` |
| Add bot protection | **Checked** |

4. Click **Create**, then **Save**

### Step 5: Review + Create

1. Go to **Review + create** tab
2. Review the configuration
3. Click **Create**
4. Wait ~5–10 minutes for deployment

---

## Post-Deployment Steps (CRITICAL)

### 1. Lock App Service to Front Door Only

This is the **most important** post-deployment step. Without it, attackers can bypass Front Door and hit the App Service directly.

**If deployed via Bicep:** This is done automatically by the `appServiceAccessRestrictions` resource.

**If deployed via Portal:**

1. Get your Front Door ID:
   - Go to **Front Door profile** > **Overview** > Copy the **Front Door ID** (a GUID)

2. Lock the App Service:
   - Go to **App Service** (`app-copichat-4kt5uxo2hrzri-webapi`) > **Networking** > **Access Restrictions**
   - Click **+ Add** under the main site rules
   - Add rule:

| Field | Value |
|-------|-------|
| Name | `Allow-FrontDoor-Only` |
| Action | **Allow** |
| Priority | 100 |
| Type | **Service Tag** |
| Service Tag | `AzureFrontDoor.Backend` |
| X-Azure-FDID header | Paste your Front Door ID |

   - Set the default rule to **Deny**

**Verify it works:**
```bash
# This should work (through Front Door):
curl https://mimir-{hash}.a01.azurefd.net/healthz

# This should return 403 Forbidden (direct access blocked):
curl https://app-copichat-4kt5uxo2hrzri-webapi.azurewebsites.net/healthz
```

### 2. Verify WAF Mode is Prevention

1. Go to **WAF policy** (`wafmimir`) > **Policy settings**
2. Ensure **Mode** is set to **Prevention** (not Detection)
   - Detection mode only logs attacks but doesn't block them
   - Prevention mode actively blocks malicious requests

### 3. Add Custom Domain (mimir.vlfk.no)

1. Go to **Front Door profile** > **Domains** > **+ Add**
2. Select **Custom domain**
3. Enter `mimir.vlfk.no`
4. Azure will show you a CNAME or TXT record to add for validation
5. Add the validation record in your DNS provider
6. Once validated, update the DNS:
   - Change the CNAME for `mimir.vlfk.no` to point to `mimir-{hash}.a01.azurefd.net`
7. Associate the custom domain with the route:
   - Go to **Routes** > `mimir-route` > **Domains** > Add `mimir.vlfk.no`
8. Associate the custom domain with the security policy:
   - Go to **Security policies** > `waf-mimir` > **Domains** > Add `mimir.vlfk.no`

### 4. Update CORS Settings

If your frontend uses a different domain than the API, ensure the Front Door hostname is added to the allowed CORS origins in `appsettings.json` or via App Service CORS configuration:

```json
"AllowedOrigins": [
  "https://mimir.vlfk.no",
  "https://mimir-{hash}.a01.azurefd.net"
]
```

### 5. Monitor WAF Logs

After deployment, monitor the WAF logs to ensure:
- Legitimate traffic is NOT being blocked (false positives)
- Attack traffic IS being blocked

**In Azure Portal:**
1. Go to **Front Door profile** > **Logs** (or **Diagnostic settings**)
2. Run this KQL query to see WAF actions:

```kusto
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.CDN"
| where Category == "FrontDoorWebApplicationFirewallLog"
| project TimeGenerated, action_s, ruleName_s, host_s, requestUri_s, clientIP_s
| order by TimeGenerated desc
```

3. If legitimate requests are being blocked, you can create rule exclusions:
   - Go to **WAF policy** > **Managed rules** > Find the rule > **Add exclusion**

---

## Estimated Cost

| Component | Monthly Cost (est.) |
|-----------|-------------------|
| Front Door Premium (base) | ~3,600 NOK (~$350) |
| WAF Policy (managed rules) | Included in Premium |
| Data transfer (~50 GB/month) | ~400 NOK (~$40) |
| **Total** | **~4,000 NOK (~$390/month)** |

This is approximately 10–13% of the current infrastructure cost (~30,000 NOK/month).

---

## Troubleshooting

### Front Door returns 503 Service Unavailable
- Check that the App Service is running
- Check that the origin health probe path (`/healthz`) returns 200
- Check that the App Service is not blocked by its own access restrictions before you add the Front Door rules

### WAF blocks legitimate requests (false positives)
- Check WAF logs (see monitoring section above)
- Create rule exclusions for the specific rules triggering on legitimate traffic
- Common: large file uploads may trigger request body size limits — adjust in WAF policy settings

### Users get authentication errors after adding Front Door
- Ensure the Front Door hostname is added to the Azure AD app registration redirect URIs
- Ensure CORS allows the Front Door hostname
- Ensure the `Origin host header` in the origin configuration matches the App Service hostname

### WebSocket/SignalR issues
- Ensure `webSocketsEnabled` is `true` in the App Service config (already set in `main.bicep`)
- Ensure session affinity is enabled on the origin group
- Front Door Premium supports WebSocket natively

---

## Resources

- [Azure Front Door documentation](https://learn.microsoft.com/azure/frontdoor/)
- [WAF on Azure Front Door](https://learn.microsoft.com/azure/web-application-firewall/afds/afds-overview)
- [Restrict access to Azure Front Door origin](https://learn.microsoft.com/azure/frontdoor/origin-security)
- [Azure Front Door + App Service best practices](https://learn.microsoft.com/azure/frontdoor/integrate-app-service)

---

*Guide created: February 16, 2026*  
*Based on: Production error analysis showing 958 malicious probes in 5 days*
