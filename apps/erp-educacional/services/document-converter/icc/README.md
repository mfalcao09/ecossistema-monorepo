# Perfil ICC sRGB

Esta pasta deve conter o arquivo `sRGB.icc` (perfil de cor sRGB padrão).

O Dockerfile usa o pacote `icc-profiles-free` do sistema, que normalmente instala
o perfil em `/usr/share/color/icc/`. Esta pasta é o fallback caso o sistema
não tenha o perfil instalado.

## Como obter o arquivo

O arquivo `sRGB.icc` pode ser obtido de:
- Pacote `icc-profiles-free` do Debian/Ubuntu
- ICC Color Consortium: https://www.color.org/srgbprofiles.xalter
- Adobe ICC Profiles

## No Docker

O Dockerfile instala o `icc-profiles-free` automaticamente, então este fallback
raramente será necessário em produção. É útil para desenvolvimento local sem Docker.
