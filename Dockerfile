FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Depmap.sln ./
COPY src/Depmap.Core/Depmap.Core.csproj src/Depmap.Core/
COPY src/Depmap.Service/Depmap.Service.csproj src/Depmap.Service/
COPY test/Depmap.Tests/Depmap.Tests.csproj test/Depmap.Tests/
RUN dotnet restore src/Depmap.Service/Depmap.Service.csproj

COPY . .
RUN dotnet publish src/Depmap.Service/Depmap.Service.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV Depmap__Roots__0=/repos

COPY --from=build /app/publish ./

EXPOSE 8080

ENTRYPOINT ["dotnet", "Depmap.Service.dll"]
