// javascript
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
    plugins: [mkcert()],
    server: {
        host: true,    // or 'localhost'
        https: true,
        port: 5173
    }
})

/*
Optional manual fallback (if you want to generate cert files yourself with mkcert):
1) run: mkcert -cert-file localhost.pem -key-file localhost-key.pem localhost 127.0.0.1 ::1
2) replace server.https with:
   https: {
     key: fs.readFileSync(path.resolve(__dirname, 'localhost-key.pem')),
     cert: fs.readFileSync(path.resolve(__dirname, 'localhost.pem'))
   }
*/