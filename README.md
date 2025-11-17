# Copilot Chat Sample Application

> This sample is for educational purposes only and is not recommended for production deployments.

# About Copilot Chat

This sample allows you to build your own integrated large language model chat copilot.
This is an enriched intelligence app, with multiple dynamic components including
command messages, user intent, and memories.

The chat prompt and response will evolve as the conversation between the user and the application proceeds.
This chat experience is orchestrated with Semantic Kernel and a Copilot Chat skill containing numerous
functions that work together to construct each response.

![UI Sample](images/UI-Sample.png)

## 🎉 NEW: MCP Integration with 25 Additional Tools!

This fork includes full **Model Context Protocol (MCP)** integration, giving your chat assistant 25 additional tools from a FastMCP server:

- **Math operations** (add, multiply, divide, average)
- **String manipulation** (reverse, count words, case conversion, find/replace)
- **File operations** (read, write, list directories)
- **Date/time utilities** (current time, format dates, calculate days)
- **RAG capabilities** (ingest documents, semantic search)
- And more!

**Quick Start:** See [QUICK_START.md](./QUICK_START.md) or [WHATS_NEW.md](./WHATS_NEW.md)

# Automated Setup and Local Deployment

> **NEW:** Run `.\scripts\Start.ps1` to start everything (MCP Bridge + Backend + Frontend)!

Refer to [./scripts/README.md](./scripts/README.md) for local configuration and deployment.

Refer to [./deploy/README.md](./deploy/README.md) for Azure configuration and deployment.

# Manual Setup and Local Deployment

## Configure your environment

Before you get started, make sure you have the following requirements in place:

- [.NET 6.0 SDK](https://dotnet.microsoft.com/download/dotnet/6.0)
- [Node.js](https://nodejs.org/)
- [Yarn](https://classic.yarnpkg.com/lang/en/docs/install) - After installation, run `yarn --version` in a terminal window to ensure you are running v1.22.19.
- [Azure OpenAI](https://aka.ms/oai/access) resource or an account with [OpenAI](https://platform.openai.com).
- [Visual Studio Code](https://code.visualstudio.com/Download) **(Optional)** 

## Start the WebApi Backend Server

The sample uses two applications, a front-end web UI, and a back-end API server.
First, let’s set up and verify the back-end API server is running.

1. Generate and trust a localhost developer certificate. Open a terminal and run:
   - For Windows and Mac run `dotnet dev-certs https --trust` and select `Yes` when asked if you want to install this certificate.
   - For Linux run `dotnet dev-certs https`
   > **Note:** It is recommended you close all instances of your web browser after installing the developer certificates.

2. Navigate to `webapi/` and open `appsettings.json`
   - Update the `AIService` configuration section:
     - Update `Type` to the AI service you will be using (i.e., `AzureOpenAI` or `OpenAI`).
     - If your are using Azure OpenAI, update `Endpoint` to your Azure OpenAI resource Endpoint address (e.g.,
       `http://contoso.openai.azure.com`).
        > If you are using OpenAI, this property will be ignored.
     - Set your Azure OpenAI or OpenAI key by opening a terminal in the webapi project directory and using `dotnet user-secrets`
       ```bash
       cd webapi
       dotnet user-secrets set "AIService:Key" "MY_AZUREOPENAI_OR_OPENAI_KEY"
       ```
     - **(Optional)** Update `Models` to the Azure OpenAI deployment or OpenAI models you want to use. 
       - For `Completion` and `Planner`, CopilotChat is optimized for Chat completion models, such as gpt-3.5-turbo and gpt-4.
         > **Important:** gpt-3.5-turbo is normally labelled as "`gpt-35-turbo`" (no period) in Azure OpenAI and "`gpt-3.5-turbo`" (with a period) in OpenAI.
       - For `Embedding`, `text-embedding-ada-002` is sufficient and cost-effective for generating embeddings.
       > **Important:** If you are using Azure OpenAI, please use [deployment names](https://learn.microsoft.com/azure/cognitive-services/openai/how-to/create-resource). If you are using OpenAI, please use [model names](https://platform.openai.com/docs/models).
   
   - **(Optional)** To enable speech-to-text for chat input, update the `AzureSpeech` configuration section:
     > If you have not already, you will need to [create an Azure Speech resource](https://ms.portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices)
       (see [./webapi/appsettings.json](webapi/appsettings.json) for more details).
     - Update `Region` to whichever region is appropriate for your speech sdk instance.
     - Set your Azure speech key by opening a terminal in the webapi project directory and setting
       a dotnet user-secrets value for `AzureSpeech:Key`
       ```bash
       dotnet user-secrets set "AzureSpeech:Key" "MY_AZURE_SPEECH_KEY" 
       ```

3. Build and run the back-end API server
    1. Open a terminal and navigate to `webapi/`
    
    2. Run `dotnet build` to build the project.
    
    3. Run `dotnet run` to start the server.
    
    4. Verify the back-end server is responding, open a web browser and navigate to `https://localhost:40443/healthz`
       > The first time accessing the probe you may get a warning saying that there is a problem with website's certificate.
         Select the option to accept/continue - this is expected when running a service on `localhost`
         It is important to do this, as your browser may need to accept the certificate before allowing the frontend to communicate with the backend.

      > You may also need to acknowledge the Windows Defender Firewall, and allow the app to communicate over private or public networks as appropriate.

## Start the WebApp FrontEnd application

1. Build and start the front-end application
   1. You will need an Azure Active Directory (AAD) application registration. 
      > For more details on creating an application registration, go [here](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app).
      - Select `Single-page application (SPA)` as platform type, and set the Web redirect URI to `http://localhost:3000`
      - Select `Accounts in any organizational directory and personal Microsoft Accounts` as supported account types for this sample.
      - Make a note of the `Application (client) ID` from the Azure Portal, we will use of it later.

   2. Open a terminal and navigate to `webapp/` Copy `.env.example` into a new
      file `.env` and update the `REACT_APP_AAD_CLIENT_ID` with the AAD application (Client) ID created above.
      For example:
      ```bash
      ./configure.sh --aiservice OpenAI --apikey {API_KEY}
      ```

      - `API_KEY`: The `API key` for OpenAI.

   2. For Azure OpenAI

      ```bash
      ./configure.sh --aiservice AzureOpenAI \
                     --endpoint {AZURE_OPENAI_ENDPOINT} \
                     --apikey   {API_KEY}
      ```

      - `AZURE_OPENAI_ENDPOINT`: The Azure OpenAI resource `Endpoint` address.
      - `API_KEY`: The `API key` for Azure OpenAI.

      **IMPORTANT:** If you deployed models `gpt-4o` and `text-embedding-ada-002`
      with custom names (instead of the default names), you need to specify
      the deployment names with three additional parameters:

      ```bash
      ./configure.sh --aiservice AzureOpenAI \
                     --endpoint        {AZURE_OPENAI_ENDPOINT} \
                     --apikey          {API_KEY} \
                     --completionmodel {DEPLOYMENT_NAME} \
                     --embeddingmodel  {DEPLOYMENT_NAME}
      ```

1. Run Chat Copilot locally. This step starts both the backend API and frontend application.

   ```bash
   ./start.sh
   ```

   It may take a few minutes for Yarn packages to install on the first run.

   > NOTE: Confirm pop-ups are not blocked and you are logged in with the same account used to register the application.

   - (Optional) To start ONLY the backend:

     ```powershell
     ./start-backend.sh
     ```

## (Optional) Run the [memory pipeline](./memorypipeline/README.md)

By default, the webapi is configured to work without the memory pipeline for synchronous processing documents. To enable asynchronous document processing, you need to configure the webapi and the memory pipeline. Please refer to the [webapi README](./webapi/README.md) and the [memory pipeline README](./memorypipeline/README.md) for more information.

## (Optional) Enable backend authentication via Azure AD

By default, Chat Copilot runs locally without authentication, using a guest user profile. If you want to enable authentication with Azure Active Directory, follow the steps below.

### Requirements

- [Azure account](https://azure.microsoft.com/free)
- [Azure AD Tenant](https://learn.microsoft.com/azure/active-directory/develop/quickstart-create-new-tenant)

### Instructions

1. Create an [application registration](https://learn.microsoft.com/azure/active-directory/develop/quickstart-register-app) for the frontend web app, using the values below

   - `Supported account types`: "_Accounts in this organizational directory only ({YOUR TENANT} only - Single tenant)_"
   - `Redirect URI (optional)`: _Single-page application (SPA)_ and use _http://localhost:3000_.

2. Create a second [application registration](https://learn.microsoft.com/azure/active-directory/develop/quickstart-register-app) for the backend web api, using the values below:
   - `Supported account types`: "_Accounts in this organizational directory only ({YOUR TENANT} only - Single tenant)_"
   - Do **not** configure a `Redirect URI (optional)`

> NOTE: Other account types can be used to allow multitenant and personal Microsoft accounts to use your application if you desire. Doing so may result in more users and therefore higher costs.

> Take note of the `Application (client) ID` for both app registrations as you will need them in future steps.

3. Expose an API within the second app registration

   1. Select _Expose an API_ from the menu

   2. Add an _Application ID URI_

      1. This will generate an `api://` URI

      2. Click _Save_ to store the generated URI

   3. Add a scope for `access_as_user`

      1. Click _Add scope_

      2. Set _Scope name_ to `access_as_user`

      3. Set _Who can consent_ to _Admins and users_

      4. Set _Admin consent display name_ and _User consent display name_ to `Access copilot chat as a user`

      5. Set _Admin consent description_ and _User consent description_ to `Allows the accesses to the Copilot chat web API as a user`

   4. Add the web app frontend as an authorized client application

      1. Click _Add a client application_

      2. For _Client ID_, enter the frontend's application (client) ID

      3. Check the checkbox under _Authorized scopes_

      4. Click _Add application_

4. Add permissions to web app frontend to access web api as user

   1. Open app registration for web app frontend

   2. Go to _API Permissions_

   3. Click _Add a permission_

   4. Select the tab _APIs my organization uses_

   5. Choose the app registration representing the web api backend

   6. Select permissions `access_as_user`

   7. Click _Add permissions_

5. Run the Configure script with additional parameters to set up authentication.

   **Powershell**

   ```powershell
   .\Configure.ps1 -AiService {AI_SERVICE} -APIKey {API_KEY} -Endpoint {AZURE_OPENAI_ENDPOINT} -FrontendClientId {FRONTEND_APPLICATION_ID} -BackendClientId {BACKEND_APPLICATION_ID} -TenantId {TENANT_ID} -Instance {AZURE_AD_INSTANCE}
   ```

   **Bash**

   ```bash
   ./configure.sh --aiservice {AI_SERVICE} --apikey {API_KEY} --endpoint {AZURE_OPENAI_ENDPOINT} --frontend-clientid {FRONTEND_APPLICATION_ID} --backend-clientid {BACKEND_APPLICATION_ID} --tenantid {TENANT_ID} --instance {AZURE_AD_INSTANCE}
   ```

   - `AI_SERVICE`: `AzureOpenAI` or `OpenAI`.
   - `API_KEY`: The `API key` for Azure OpenAI or for OpenAI.
   - `AZURE_OPENAI_ENDPOINT`: The Azure OpenAI resource `Endpoint` address. This is only required when using Azure OpenAI, omit `-Endpoint` if using OpenAI.
   - `FRONTEND_APPLICATION_ID`: The `Application (client) ID` associated with the application registration for the frontend.
   - `BACKEND_APPLICATION_ID`: The `Application (client) ID` associated with the application registration for the backend.
   - `TENANT_ID` : Your Azure AD tenant ID
   - `AZURE_AD_INSTANCE` _(optional)_: The Azure AD cloud instance for the authenticating users. Defaults to `https://login.microsoftonline.com`.

6. Run Chat Copilot locally. This step starts both the backend API and frontend application.

   **Powershell**

   ```powershell
   .\Start.ps1
   ```

   **Bash**

   ```bash
   ./start.sh
   ```

## Optional Configuration: [Ms Graph API Plugin with On-Behalf-Of Flow](./plugins/OBO/README.md)

This native plugin enables the execution of Microsoft Graph APIs using the On-Behalf-Of (OBO) flow with delegated permissions.

The OBO flows is used to ensure that the backend APIs are consumed with the identity of the user, not the managed identity or service principal of the middle-tier application (in this case the WebApi).

Also, this ensures that consent is given, so that the client app (WebApp) can call the middle-tier app (WebApi), and the middle-tier app has permission to call the back-end resource (MSGraph).

This sample does not implement incremental consent in the UI so all the Graph scopes to be used need to have "Administrator Consent" given in the middle-tier app registration.

More information in the [OBO readme.md](./plugins/OBO/README.md).

### Requirements

Backend authentication via Azure AD must be enabled. Detailed instructions for enabling backend authentication are provided below.

### Limitations

- Currently, the plugin only supports GET operations. Future updates may add support for other types of operations.
- Graph queries that return large results, may reach the token limit for the AI model, producing an error.
- Incremental consent is not implemented in this sample.

# Troubleshooting

1. **_Issue:_** Unable to load chats.

   _Details_: interaction*in_progress: Interaction is currently in progress.*

   _Explanation_: The WebApp can display this error when the application is configured for a different AAD tenant from the browser, (e.g., personal/MSA account vs work/school account).

   _Solution_: Either use a private/incognito browser tab or clear your browser credentials/cookies. Confirm you are logged in with the same account used to register the application.

2. **_Issue:_**: Challenges using text completion models, such as `text-davinci-003`

   _Solution_: For OpenAI, see [model endpoint compatibility](https://platform.openai.com/docs/models/model-endpoint-compatibility) for
   the complete list of current models supporting chat completions. For Azure OpenAI, see [model summary table and region availability](https://learn.microsoft.com/azure/ai-services/openai/concepts/models#model-summary-table-and-region-availability).

3. **_Issue:_** Localhost SSL certificate errors / CORS errors

   ![Cert-Issue](https://github.com/microsoft/chat-copilot/assets/64985898/e9072af1-e43c-472d-bebc-d0082d0c9180)

   _Explanation_: Your browser may be blocking the frontend access to the backend while waiting for your permission to connect.

   _Solution_:

   1. Confirm the backend service is running. Open a web browser and navigate to `https://localhost:40443/healthz`
      - You should see a confirmation message: `Healthy`
      - If your browser asks you to acknowledge the risks of visiting an insecure website, you must acknowledge this before the frontend can connect to the backend server.
   2. Navigate to `http://localhost:3000` or refresh the page to use the Chat Copilot application.

4. **_Issue:_** Yarn is not working.

   _Explanation_: You may have the wrong Yarn version installed such as v2.x+.

   _Solution_: Use the classic version.

   ```bash
   npm install -g yarn
   yarn set version classic
   ```

You can confirm the active Yarn version by running `yarn --version`.

# Additional resources

1. [Import Document Application](./importdocument/README.md): Import a document to the memory store.
