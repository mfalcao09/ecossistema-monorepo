---
name: Dados sempre do XML — regra máxima do Diploma Digital
description: Dados sempre do XML — regra máxima do Diploma Digital
type: feedback
project: erp
tags: ["xml", "dados", "regra-maxima"]
success_score: 0.95
supabase_id: 21594f5d-9896-4a51-936e-c803d2a179e2
created_at: 2026-04-13 09:14:17.519968+00
updated_at: 2026-04-13 11:04:55.647299+00
---

Dados exibidos no sistema de diploma digital devem vir SEMPRE do XML do diploma e nunca de informações que nós inserimos/presumimos no banco de dados. O banco de dados deve ser SEMPRE alimentado pelo XML. Cada XML é um caso e os dados daquele caso estarão no próprio XML. Nunca sugerir preenchimento manual de campos que "provavelmente" teriam determinado valor. Se um campo não existe no XML, ele fica NULL no banco — e o sistema deve lidar com isso.
