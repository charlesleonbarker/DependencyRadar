# Stage 1: build React frontend
FROM node:22-alpine AS node-build
WORKDIR /web
COPY src/DependencyRadar.Web/package*.json ./
RUN npm ci --ignore-scripts
COPY src/DependencyRadar.Web/ ./
RUN npm run build

# Stage 2: build .NET backend
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS dotnet-build
WORKDIR /src
COPY DependencyRadar.sln ./
COPY src/DependencyRadar.Core/DependencyRadar.Core.csproj src/DependencyRadar.Core/
COPY src/DependencyRadar.Service/DependencyRadar.Service.csproj src/DependencyRadar.Service/
COPY test/DependencyRadar.Tests/DependencyRadar.Tests.csproj test/DependencyRadar.Tests/
RUN dotnet restore src/DependencyRadar.Service/DependencyRadar.Service.csproj
COPY . .
RUN dotnet publish src/DependencyRadar.Service/DependencyRadar.Service.csproj -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: minimal Alpine runtime — API + frontend on port 8080
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final
WORKDIR /app

RUN addgroup -S -g 1001 dependencyradar && adduser -S -u 1001 -G dependencyradar dependencyradar

COPY --from=dotnet-build /app/publish ./
COPY --from=node-build /web/dist ./wwwroot
COPY test/fixtures /fixtures
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
 && chown -R dependencyradar:dependencyradar /app /fixtures

ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/status || exit 1

USER dependencyradar

# Mount your repos at /repos to scan them; falls back to bundled fixtures otherwise.
ENTRYPOINT ["/entrypoint.sh"]
