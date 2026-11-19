# Política de segurança

O Orto Fortino guarda dados pessoais e de saúde (LGPD). Levamos a segurança a sério.

## Como reportar uma vulnerabilidade

Use o **relato privado de vulnerabilidades do GitHub**: aba **Security → Report a vulnerability** deste repositório.

- **Não** abra uma issue pública nem publique detalhes antes da correção.
- Descreva o problema, os passos para reproduzir e o impacto.
- **Não** acesse, copie nem altere dados reais de pacientes ao testar.

Respondemos assim que possível e avisamos quando a correção for publicada.

## Escopo

Falhas de autenticação, de autorização (RLS), de sessão e cookies, de CSP e cabeçalhos, injeção, exposição de dados e de segredos.

Fora do escopo: ataques de negação de serviço, engenharia social e testes contra o ambiente de produção da empresa.

## Segredos

Se você encontrar uma chave ou senha no histórico do repositório, reporte pelo mesmo canal. Nenhum segredo real deve estar versionado: o único arquivo de ambiente no git é o `.env.example`, com marcadores.
