# Cloudflare Worker TMDB proxy untuk Blogger

File Worker ada di [worker.js](./worker.js). Backend ini membuat API proxy agar Blogger tidak perlu memanggil TMDB secara langsung.

## Pasang lewat dashboard (tanpa CLI)

1. Buka Cloudflare Dashboard → **Workers & Pages** → **Create** → **Create Worker**.
2. Beri nama, misalnya `cinema-scope-tmdb`, lalu buat Worker.
3. Buka **Edit code**, ganti seluruh contoh kode dengan isi `worker.js` pada folder ini, lalu **Deploy**.
4. Buka pengaturan Worker → **Settings → Variables and Secrets**. Tambahkan:
   - `TMDB_API_KEY` — secret berisi API key TMDB yang valid.
   - `BLOGGER_ORIGINS` — text variable berisi origin blog, misalnya `https://namablog.blogspot.com`. Untuk domain custom, tulis origin sebenarnya. Jika lebih dari satu, pisahkan dengan koma.
5. Setelah mengubah secret/variable, simpan dan lakukan deploy terbaru bila dashboard memintanya.
6. Buka URL Worker tanpa parameter. Respons JSON dengan `"ok": true` berarti Worker hidup.
7. Di template Blogger, atur `TMDB_PROXY_BASE` ke URL Worker lengkap, misalnya `https://cinema-scope-tmdb.nama-akun.workers.dev`.

## Bentuk endpoint yang dipakai

`https://YOUR-WORKER.workers.dev/?path=%2F3%2Ftrending%2Fall%2Fweek&language=id-ID`

Gunakan alamat Worker yang benar-benar diberikan dashboard. Jangan tempel nilai `TMDB_API_KEY` ke HTML Blogger.

## Catatan keamanan

- CORS dibatasi ke origin yang kamu masukkan di `BLOGGER_ORIGINS`.
- API key disimpan di secret Worker, tidak di request dari Blogger.
- Worker hanya mengizinkan endpoint TMDB yang dibutuhkan aplikasi.
