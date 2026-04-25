# Stage 1: build React frontend
FROM node:22-alpine AS node-build
WORKDIR /web
COPY src/Depmap.Web/package*.json ./
RUN npm ci --ignore-scripts
COPY src/Depmap.Web/ ./
RUN npm run build

# Stage 2: build .NET backend
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS dotnet-build
WORKDIR /src
COPY Depmap.sln ./
COPY src/Depmap.Core/Depmap.Core.csproj src/Depmap.Core/
COPY src/Depmap.Service/Depmap.Service.csproj src/Depmap.Service/
COPY test/Depmap.Tests/Depmap.Tests.csproj test/Depmap.Tests/
RUN dotnet restore src/Depmap.Service/Depmap.Service.csproj
COPY . .
RUN dotnet publish src/Depmap.Service/Depmap.Service.csproj -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: minimal Alpine runtime — API + frontend on port 8080
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final
WORKDIR /app

# Non-root user with explicit UID/GID so the Helm securityContext can reference it
RUN addgroup -S -g 1001 dependencyradar && adduser -S -u 1001 -G dependencyradar dependencyradar

COPY --from=dotnet-build /app/publish ./
COPY --from=node-build /web/dist ./wwwroot
COPY test/fixtures /fixtures
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
 && chown -R dependencyradar:dependencyradar /app /fixtures

ENV ASPNETCORE_URLS=http://+:8080
# Alpine uses musl libc; invariant mode avoids an ICU package dependency.
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/status || exit 1

USER dependencyradar

# Mount your repos at /repos to scan them; falls back to bundled fixtures otherwise.
ENTRYPOINT ["/entrypoint.sh"]
