# 前端构建
FROM node:22-alpine AS fe
WORKDIR /fe
COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN npm i -g pnpm && pnpm install --ignore-scripts
COPY frontend .
RUN pnpm run build

# 后端编译
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS be
WORKDIR /src
COPY backend/ .
RUN dotnet publish -c Release -o /app

# 运行镜像：ASP.NET 托管 API + 前端静态文件
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=be /app .
COPY --from=fe /fe/dist ./wwwroot
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "backend.dll"]
