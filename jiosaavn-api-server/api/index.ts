import app from '../src/server'

export const config = {
  runtime: 'edge'
}

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const matchedPath = req.headers.get('x-matched-path')
  if (matchedPath && matchedPath !== url.pathname) {
    url.pathname = matchedPath
    const newReq = new Request(url.toString(), req)
    return app.fetch(newReq)
  }
  return app.fetch(req)
}
