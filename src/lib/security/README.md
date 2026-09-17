# Security Module - Autenticação e Segurança

Módulo responsável por toda a camada de segurança e autenticação do LaunchCraft MVP.

## 📦 Stack

- **Hash de Senhas**: bcrypt (10 rounds)
- **JWT**: jsonwebtoken
- **Tokens**: Access Token (15min) + Refresh Token (7 dias)
- **Cookies**: httpOnly, secure (produção), sameSite

## 🔐 Componentes

### 1. Hash de Senhas (`hash.ts`)

Gerencia hash seguro de senhas com bcrypt.

```typescript
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/security';

// Hash de senha
const hash = await hashPassword('MinhaSenh@123');

// Verificar senha
const isValid = await verifyPassword('MinhaSenh@123', hash);

// Validar força
const validation = validatePasswordStrength('MinhaSenh@123');
if (!validation.isValid) {
  console.error(validation.error);
}
```

**Requisitos de senha:**
- Mínimo 8 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 letra minúscula
- Pelo menos 1 número
- Pelo menos 1 caractere especial

### 2. JWT (`jwt.ts`)

Gerencia geração e validação de tokens JWT.

```typescript
import { generateTokens, verifyAccessToken, verifyRefreshToken } from '@/lib/security';

// Gerar tokens
const tokens = generateTokens({
  userId: user.id,
  email: user.email,
  role: user.role,
});

// Validar access token
const validation = verifyAccessToken(tokens.accessToken);
if (validation.isValid) {
  console.log('User ID:', validation.payload.userId);
}

// Validar refresh token
const refreshValidation = verifyRefreshToken(tokens.refreshToken);
```

**Duração dos tokens:**
- Access Token: 15 minutos
- Refresh Token: 7 dias

### 3. Middleware de Autenticação (`auth-middleware.ts`)

Protege rotas da API.

```typescript
import { withAuth, withAdminAuth, withOptionalAuth } from '@/lib/security';

// Rota protegida (requer autenticação)
export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    const user = req.user; // Usuário autenticado disponível
    // ... lógica da rota
  });
}

// Rota apenas para admins
export async function DELETE(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    // Apenas admins chegam aqui
    // ... lógica da rota
  });
}

// Rota com autenticação opcional
export async function GET(request: NextRequest) {
  return withOptionalAuth(request, async (req) => {
    if (req.user) {
      // Comportamento para usuário autenticado
    } else {
      // Comportamento para usuário anônimo
    }
  });
}
```

### 4. Obter Usuário Atual (`get-current-user.ts`)

Obtém dados completos do usuário autenticado.

```typescript
import { getCurrentUser, canCreateProject } from '@/lib/security';

// Obter dados completos
const user = await getCurrentUser(jwtPayload);
console.log(user.name, user.plan.name);

// Verificar limite de projetos
const canCreate = await canCreateProject(userId);
if (!canCreate) {
  // Usuário atingiu limite do plano
}
```

## 🌐 API Routes

### POST /api/auth/signup
Cadastro de novo usuário.

**Request:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "MinhaSenh@123",
  "name": "João Silva"
}
```

**Response (201):**
```json
{
  "message": "Cadastro realizado com sucesso",
  "user": {
    "id": "uuid",
    "email": "usuario@exemplo.com",
    "name": "João Silva",
    "role": "USER",
    "plan": { "name": "Gratuito" }
  },
  "accessToken": "eyJhbGc..."
}
```

### POST /api/auth/login
Login de usuário existente.

**Request:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "MinhaSenh@123"
}
```

**Response (200):**
```json
{
  "message": "Login realizado com sucesso",
  "user": { ... },
  "accessToken": "eyJhbGc..."
}
```

### POST /api/auth/refresh
Renova access token usando refresh token do cookie.

**Request:** (vazio, refresh token vem do cookie)

**Response (200):**
```json
{
  "message": "Token renovado com sucesso",
  "accessToken": "eyJhbGc...",
  "user": { ... }
}
```

### POST /api/auth/logout
Remove refresh token e invalida sessão.

**Request:** (vazio)

**Response (200):**
```json
{
  "message": "Logout realizado com sucesso"
}
```

### GET /api/auth/me
Retorna dados do usuário autenticado (requer autenticação).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "usuario@exemplo.com",
    "name": "João Silva",
    "role": "USER",
    "emailVerified": false,
    "plan": { "name": "Gratuito", "maxProjects": 3 }
  }
}
```

## 🔄 Fluxo de Autenticação

### 1. Cadastro
```
Cliente → POST /api/auth/signup
       → Hash da senha (bcrypt)
       → Criar usuário no banco
       → Gerar access + refresh tokens
       ← Access token (JSON) + Refresh token (cookie)
```

### 2. Login
```
Cliente → POST /api/auth/login
       → Verificar senha (bcrypt.compare)
       → Gerar access + refresh tokens
       ← Access token (JSON) + Refresh token (cookie)
```

### 3. Acesso a Rotas Protegidas
```
Cliente → GET /api/... 
        → Header: Authorization: Bearer <accessToken>
        → Middleware valida token
        → Extrai payload (userId, email, role)
        ← Resposta da rota
```

### 4. Renovação de Token
```
Cliente → POST /api/auth/refresh
        → Cookie: refreshToken
        → Valida refresh token
        → Gera novos tokens
        ← Novo access token + novo refresh token (rotation)
```

### 5. Logout
```
Cliente → POST /api/auth/logout
        → Remove cookie refreshToken
        ← Sessão invalidada
```

## 🛡️ Segurança

### Proteções Implementadas

✅ **Senhas**
- Hash bcrypt com 10 rounds (salt automático)
- Validação de força obrigatória
- Nunca armazenadas em texto plano

✅ **JWT**
- Tokens assinados (HMAC SHA256)
- Secrets seguros (64 bytes aleatórios)
- Expiração automática
- Refresh token rotation

✅ **Cookies**
- httpOnly (inacessível via JavaScript)
- secure em produção (HTTPS only)
- sameSite: lax (CSRF protection)
- Path: / (válido para toda aplicação)

✅ **API**
- Middleware de autenticação
- Separação user/admin
- Validação de entrada
- Mensagens de erro genéricas (não revela detalhes)

### Variáveis de Ambiente

```env
JWT_SECRET="<64-bytes-random-hex>"
JWT_REFRESH_SECRET="<64-bytes-random-hex>"
```

**⚠️ IMPORTANTE**: 
- NUNCA commitar .env no Git
- Gerar secrets únicos para cada ambiente
- Usar secrets diferentes para dev/staging/prod

## 🧪 Testes

```bash
# Testar autenticação
npm run test:auth

# Ou manualmente
npx tsx src/lib/security/test-auth.ts
```

Testes cobrem:
1. Hash e verificação de senha
2. Validação de força de senha
3. Geração e validação de access token
4. Geração e validação de refresh token

## 📝 Exemplo Completo

### Cliente (Frontend)

```typescript
// 1. Cadastro
const signupResponse = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'usuario@exemplo.com',
    password: 'MinhaSenh@123',
    name: 'João Silva',
  }),
});

const { accessToken, user } = await signupResponse.json();
localStorage.setItem('accessToken', accessToken);

// 2. Fazer requisições autenticadas
const projectsResponse = await fetch('/api/projects', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});

// 3. Renovar token quando expirar
if (response.status === 401) {
  const refreshResponse = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include', // Envia cookies
  });
  
  const { accessToken: newToken } = await refreshResponse.json();
  localStorage.setItem('accessToken', newToken);
  
  // Tentar novamente com novo token
}

// 4. Logout
await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include',
});
localStorage.removeItem('accessToken');
```

### Servidor (API Route)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCurrentUser } from '@/lib/security';
import { prisma } from '@/modules/database';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    // Usuário autenticado disponível em req.user
    const user = await getCurrentUser(req.user!);
    
    // Buscar projetos do usuário
    const projects = await prisma.project.findMany({
      where: { userId: user!.id },
    });
    
    return NextResponse.json({ projects });
  });
}
```

## 📚 Referências

- [bcrypt - NPM](https://www.npmjs.com/package/bcrypt)
- [jsonwebtoken - NPM](https://www.npmjs.com/package/jsonwebtoken)
- [JWT.io](https://jwt.io/)
- [OWASP Password Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
