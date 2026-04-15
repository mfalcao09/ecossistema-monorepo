# ============================================
# DocumentConverter — Microserviço PDF/A
# FIC Diploma Digital
#
# Converte documentos (JPG/PNG/PDF) para PDF/A
# usando Ghostscript e valida com veraPDF
# ============================================

FROM node:20-slim

# Instalar dependências do sistema:
# - ghostscript: conversão para PDF/A
# - icc-profiles-free: perfis de cor ICC para PDF/A
# - imagemagick: suporte a imagens (JPG, PNG → PDF)
# - curl: health check
# Nota: veraPDF (validador PDF/A) é opcional — o serviço funciona sem ele.
# A validação retorna null quando veraPDF não está disponível (non-blocking).
RUN apt-get update && apt-get install -y \
    ghostscript \
    icc-profiles-free \
    imagemagick \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Configurar ImageMagick para permitir PDF
# (política padrão bloqueia escrita de PDF por segurança)
# ATENÇÃO: o sed anterior usava | como delimitador E na substituição ("read|write"),
# o que quebrava o comando silenciosamente (|| true escondia o erro).
# Solução robusta: deletar a linha de bloqueio de PDF e adicionar permissão explícita.
RUN sed -i '/<policy domain="coder" rights="none" pattern="PDF"/d' \
    /etc/ImageMagick-6/policy.xml && \
    sed -i 's|</policymap>|<policy domain="coder" rights="read\|write" pattern="PDF"/>\n</policymap>|g' \
    /etc/ImageMagick-6/policy.xml || true

# Diretório da aplicação
WORKDIR /app

# Copiar package.json e instalar dependências Node
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copiar código-fonte
COPY src/ ./src/

# Copiar perfil ICC sRGB para uso no Ghostscript
# (fallback — o sistema usa o icc-profiles-free do sistema primeiro)
COPY icc/ ./icc/

# Criar diretórios de trabalho para arquivos temporários
RUN mkdir -p /tmp/converter/input /tmp/converter/output

# Porta do serviço
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3100/health || exit 1

# Iniciar servidor
CMD ["node", "src/server.js"]
