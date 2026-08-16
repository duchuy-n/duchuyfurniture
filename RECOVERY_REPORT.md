# Bao cao khoi phuc du lieu website cu

Thoi diem tong hop: 15/08/2026.

Nguyen tac da lam: chi doc public/admin read-only, khong bam luu, khong POST chinh sua noi dung tren website cu.

## Da khoi phuc vao site moi

- 1.369 san pham trong `products.js`.
- 1.369/1.369 san pham co anh local trong `assets/products`.
- 1.320 san pham co gia so; san pham gia 0 duoc hien thi la "Lien he".
- 82 nhanh/danh muc san pham tu website cu.
- Giao dien moi responsive cho desktop/mobile, co tim kiem, loc danh muc, sap xep, hover/quick view, modal chi tiet, nut goi/Zalo/bao gia.

## Du lieu public da vet them

- Sitemap public:
  - `http://noithatduchuy.eportal.vn/sitemap.aspx`: 125 URL.
  - `http://www.noithathoaphatgroup.com.vn/sitemap.aspx`: 125 URL.
  - Tong hop unique sau khi luu ca 2 domain: 250 URL.
- RSS public:
  - 11 feed RSS doc duoc.
  - 138 bai/link RSS unique, gom chu yeu tu van va tin khuyen mai.
  - Chi tiet bai dang bi server tra 429, nen hien co metadata/title/link/description tu RSS, chua lay duoc full body.
- Anh/asset public ngoai catalog:
  - 1.591 URL anh/asset duoc thu tai.
  - 1.396 file da tai/cache local.
  - 195 URL loi, chu yeu do server/duong dan cu.
- Admin read-only:
  - Doc duoc trang Tabs/menu, File Manager, Skins.
  - Skin cu xac dinh la F008.
  - File manager bao dung luong portal khoang 98.32MB/100MB.

## File inventory quan trong

- `crawl-output/recovery-inventory.json`: tong hop phan san pham/category/admin da khoi phuc.
- `crawl-output/recovered-products-inventory.csv`: danh sach san pham da phuc hoi.
- `crawl-output/product-url-inventory.csv`: 1.369 URL detail san pham da tim thay.
- `crawl-output/article-inventory.csv`: bai viet tim thay tu crawl ban dau.
- `crawl-output/rss-items.csv`: 138 bai/link RSS unique.
- `crawl-output/rss-article-inventory.csv`: doi chieu RSS voi article inventory.
- `crawl-output/sitemap-url-inventory.csv`: doi chieu URL sitemap.
- `crawl-output/site-images-inventory.csv`: inventory anh/asset public da tai.
- `crawl-output/extra-recovery-summary.json`: tong hop sitemap/RSS/anh public.
- `crawl-output/rss-article-details-summary.json`: ket qua thu tai chi tiet bai RSS.

## Gioi han hien tai

- Product detail page: da tim duoc 1.369 URL san pham, nhung server tra 429 cho phan lon detail page, nen 1.369 san pham hien duoc lap tu listing/category, gia va anh; mot so truong nhu kich thuoc/bao hanh chi co o nhung detail page da fetch duoc truoc do.
- Article detail page: 138 link RSS da co metadata, nhung thu tai chi tiet ngay sau do gap 429 toan bo. Nen doi it nhat 10 phut hoac chay lai cham hon moi co co hoi lay full body.
- Sitemap cua he thong cu chu yeu liet ke trang/danh muc, khong liet ke 1.369 detail san pham.
- Wayback Machine/Internet Archive: da thu API CDX va Availability cho domain cu, nhung hien cung bi 429. Co the thu lai sau de tim snapshot lich su neu can.

## Buoc co the lam tiep

- Sau khi server het 429, chay lai `python fetch_rss_article_details.py` de thu lay full body 138 bai RSS.
- Neu can du lieu kich thuoc/bao hanh day du cho tung san pham, chay lai crawler detail san pham theo batch nho, delay dai hon, va dung ngay neu gap 429.
- Chon nhung asset trong `crawl-output/site-images` de dua vao hero/banner/section gioi thieu neu muon site moi giong chat web cu hon.

## Full audit ngay 16/08/2026

Da quet lai toan bo local va probe public rat nhe:

- `crawl-output/full-recovery-audit.json`: audit tong local moi nhat.
- `crawl-output/readonly-status-probe.json`: probe 4 URL public. Ket qua: trang chu, 1 detail san pham, 1 bai viet dang 429; sitemap van 200.
- `crawl-output/pending-queues-summary.json`: queue con thieu de chay lai sau cooldown.
- `render-final-audit.json`: render desktop/mobile bang Chrome headless.
- Screenshot moi: `preview-desktop-final-audit.png`, `preview-mobile-final-audit.png`.

Ket qua local:

- 1.369 san pham, 1.369 unique ID, 1.369 file anh san pham local.
- 0 anh san pham missing, 0 duplicate image path, 0 duplicate product ID.
- 1.320 san pham co gia so; 49 san pham dang hien thi Lien he.
- 82 category path.
- 44 article URL tu crawl ban dau; 138 RSS item unique.
- 250 sitemap URL.
- 1.396/1.591 site image/asset public da tai duoc.

Queue can retry sau khi het 429:

- `crawl-output/pending-product-detail-queue.csv`: 1.319 product detail page.
- `crawl-output/pending-rss-article-queue.csv`: 138 article detail page.
- `crawl-output/pending-asset-retry-queue.csv`: 195 asset/image URL.

Render site moi:

- Desktop: 24 card dau tien render, 0 anh hong sau khi scroll lazy-load, khong tran ngang.
- Mobile 390px: 24 card dau tien render, 0 anh hong sau khi scroll lazy-load, khong tran ngang.

## Cach doc tiep khong pha chan

Da them cac cach an toan de doc tiep ma khong chinh sua web cu:

- `safe_retry_readonly.py`: crawler GET-only, single-thread, co delay/jitter, co resume bang queue CSV, gap 429 thi dung ngay va giu nguyen queue.
- Da chay thu 1 product detail: server van tra 429, nen script dung dung nhu thiet ke, khong quet tiep.
- `fetch_expanded_rss.py`: thu endpoint RSS public voi `MaxCount=500` tren ca domain cu va live. Ket qua exact link 276 nhung canonical theo noi dung van la 138 bai, tuc RSS metadata da vet het phan public dang lo.
- Da soi admin HTML da luu: chua thay duong export/backup ro rang. Cac nut dang `javascript:__doPostBack(...)` co the la thao tac admin nen khong bam.

Lenh retry an toan sau khi het 429:

```powershell
python -X utf8 safe_retry_readonly.py --queue products --limit 5 --delay 45 --jitter 15 --stop-on-429
python -X utf8 safe_retry_readonly.py --queue articles --limit 5 --delay 45 --jitter 15 --stop-on-429
python -X utf8 safe_retry_readonly.py --queue assets --limit 10 --delay 10 --jitter 5 --stop-on-429
```

Khong nen dung proxy xoay, fake hang loat user-agent, hoac request song song de ne rate-limit. Cach sach nhat la cho cooldown, chay batch nho, hoac xin nha cung cap ePortal/hosting xuat database/file backup.

## Retry thanh cong ngay 16/08/2026

Sau khi server het 429 mot phan, da chay batch nho bang `safe_retry_readonly.py`:

- Product detail HTML hien co: 96 file.
- Product detail parse duoc: 96 san pham.
- Trong do: 96 co gia, 49 co kich thuoc, 51 co bao hanh, 96 co mo ta detail.
- Article detail: 46/138 bai da co full content text va image; 92 bai con 429/pending.
- Queue con lai: 1.273 product detail, 92 article detail, 195 asset/image retry.
- Catalog local da merge detail moi va regenerate `products.js`: van 1.369 san pham, 0 anh missing, VAT detail tang len 241 san pham.
- JS check: `products.js` va `script.js` hop le.

Cac file summary moi:

- `crawl-output/full-products-parse-summary.json`
- `crawl-output/rss-article-details-summary.json`
- `crawl-output/detail-update-summary.json`
- `crawl-output/pending-queues-summary.json`

## Hoan tat vet full ngay 16/08/2026

Da chay tiep bang GET-only/read-only, co checkpoint tung URL va fallback domain live `www.noithathoaphatgroup.com.vn` khi domain cu timeout/500.

Ket qua cuoi:

- Product detail: 1.369/1.369 HTML da tai va parse duoc.
- Product detail co gia: 1.369/1.369.
- Product detail co kich thuoc that: 1.213/1.369.
- Product detail co bao hanh that: 1.264/1.369.
- Product detail co mo ta: 1.369/1.369.
- Article detail: 138/138 da tai, co full content text va image.
- Product/article pending: 0.
- Site image/asset public: 1.578/1.591 da co local.
- Asset fail that sau retry: 13 URL, gom 1 status 403, 11 status 404, 1 status 0/timeout.

Site moi da cap nhat:

- `products.js` regenerate thanh cong, van 1.369 san pham.
- `node --check products.js` va `node --check script.js` deu pass.
- Audit local: 0 anh san pham missing, 0 duplicate product ID, khong thieu asset tham chieu trong HTML.
- Render desktop/mobile bang Chrome: 0 anh hong sau lazy-load, khong tran ngang, count hien `24/1369`.

File ket qua chinh:

- `crawl-output/full-products.json` / `.csv`: full detail product da parse.
- `crawl-output/rss-article-details.json` / `.csv`: full article detail da parse.
- `crawl-output/final-asset-summary.json`: tong ket asset cuoi.
- `crawl-output/final-failed-assets.csv`: 13 asset URL that bai that.
- `429_PENDING_URLS.md`: danh sach pending cuoi, product/article da het, con 13 asset fail.

