import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const port = 3000

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const teamFolder = env.IMAGES_FOLDER || 'ikgota-team16'
  const imagesDir = path.join(process.cwd(), 'public', 'exercise_images', teamFolder)

  const uploadPlugin = {
    name: 'upload-middleware',
    configureServer(server) {
      fs.mkdirSync(imagesDir, { recursive: true })

      server.middlewares.use('/api/upload', (req, res) => {
        res.setHeader('Content-Type', 'application/json')

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { filename, data } = JSON.parse(body)

            // Only allow safe filenames: letters, digits, dash, underscore + image extension
            if (!/^[\w\-]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Ogiltigt filnamn' }))
              return
            }

            const base64Data = data.replace(/^data:image\/\w+;base64,/, '')
            const buffer = Buffer.from(base64Data, 'base64')
            fs.writeFileSync(path.join(imagesDir, filename), buffer)

            res.statusCode = 200
            res.end(JSON.stringify({ ok: true, path: `/exercise_images/${teamFolder}/${filename}` }))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message }))
          }
        })
      })
    },
  }

  return {
    plugins: [react(), uploadPlugin],
    define: {
      'import.meta.env.IMAGES_FOLDER': JSON.stringify(teamFolder),
    },
    server: {
      host: true,
      port,
    },
  }
})
