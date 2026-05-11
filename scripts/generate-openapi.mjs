// Reads `@openapi` JSDoc blocks out of src/server/**/*.ts and writes a
// combined OpenAPI 3.0 spec to public/openapi.yml. Run automatically as
// part of `npm run dev` and `npm run build` — see package.json.
//
// Maintenance: when you add or change a route in src/server/, add or update
// the JSDoc `@openapi` block sitting directly above its `app.<verb>(...)`
// call. That's the single source of truth — the YAML is rebuilt from
// scratch every time.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import swaggerJsdoc from 'swagger-jsdoc'
import yaml from 'js-yaml'

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Göta off-ice',
      version: '1.0.0',
      description:
        'API för att hantera off-ice övningar — ladda upp nya övningar, redigera innehåll, och så vidare. Alla endpoints kräver Basic auth (användarnamn och lösenord).',
    },
    servers: [{ url: '/', description: 'this host' }],
    security: [{ basicAuth: [] }],
    components: {
      securitySchemes: {
        basicAuth: { type: 'http', scheme: 'basic' },
      },
      responses: {
        BadRequest: {
          description: 'Invalid request payload',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Unauthorized: {
          description: 'Missing or invalid Basic auth credentials',
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Conflict: {
          description: 'Resource already exists',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        ServerError: {
          description: 'Unexpected server error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string' },
          },
        },
        Ok: {
          type: 'object',
          required: ['ok'],
          properties: {
            ok: { type: 'boolean', enum: [true] },
          },
        },
        Crop: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            scale: { type: 'number' },
          },
        },
      },
    },
  },
  apis: ['src/server/**/*.ts'],
})

const outPath = 'public/openapi.yml'
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, yaml.dump(spec, { lineWidth: 100, noRefs: true }), 'utf8')

const pathCount = spec.paths ? Object.keys(spec.paths).length : 0
console.log(`✓ ${outPath} (${pathCount} paths)`)
