# 📘 Panduan Arsitektur & Keamanan Confidential DEX

**Confidential DEX** adalah bursa derivatif terdesentralisasi (*Decentralized Perpetual Exchange*) generasi terbaru yang memadukan kecepatan eksekusi bursa terpusat (CEX) dengan transparansi dan keamanan absolut khas Web3. Dibangun di atas infrastruktur *smart contract* modular yang sangat dioptimalkan, platform ini secara khusus dirancang untuk memecahkan tiga masalah fundamental di ranah DeFi: latensi eksekusi yang tinggi, biaya *slippage* yang merugikan, dan risiko manipulasi harga oleh paus (*whale manipulation*).

---

## 1. 🚀 Keunggulan Arsitektur V1 (Direct-to-Vault & Unified Keeper)

Setelah melalui proses pembersihan dan peremajaan kode, Confidential DEX kini beroperasi dengan model **V1 Direct-to-Vault Execution** yang bersih, efisien, dan mengutamakan kecepatan eksekusi.

*   **Zero-Latency Settlement:** Mengeliminasi sistem antrean *Peer-to-Peer* lambat. Setiap pesanan (*Market*, *Limit*, *Stop*) langsung dibenturkan ke dalam *Liquidity Vault* untuk penyelesaian instan (1-langkah).
*   **Guaranteed Liquidity:** *Trader* tidak perlu menunggu lawan transaksi. Kapasitas Vault menjamin bahwa pesanan sebesar apa pun akan tereksekusi secara absolut selama utilitas Vault mencukupi.
*   **Zero-Delay Pipeline (Event-Driven & Unified Bot):** Infrastruktur pencatatan *Goldsky GraphQL Subgraph* dan *Pyth Network* dikombinasikan secara asinkron. Setiap tekanan tombol "Buy" dari UI langsung memaketkan harga *Oracle* terkini, dan didukung oleh *Unified Keeper Bot* yang memonitor pasar 24/7.

---

## 2. 🏦 Spesifikasi Likuiditas: Dual-Tranche Vault

Likuiditas di DEX ini disegmentasi menjadi dua lapisan brankas (*tranche*) independen dengan batas kapasitas maksimal absolut (Total TVL Cap) sebesar **$50.000.000 USDC**. Brankas beroperasi menggunakan standar ERC-4626 Tokenized Vault dengan sistem *Auto-Compounding* (cUSDC).

### 🔴 Degen Vault (High-Yield Vault)
Diperuntukkan bagi penyedia likuiditas (LP) dengan profil risiko tinggi yang mendambakan pertumbuhan modal agresif.
*   **Kapasitas Maksimal (Porsi):** **$15.000.000** (30% dari Total TVL)
*   **Insentif Keuntungan:** Mendapatkan persentase laba **3x lipat lebih besar** dari seluruh pendapatan protokol (Biaya *Trading*, Likuidasi, *Funding Rate*, dan Kerugian *Trader*).
*   **Risiko (Proportional Shared-Loss):** Kerugian akibat kemenangan *trader* dibagi secara **proporsional** antara Degen dan Prime berdasarkan rasio TVL masing-masing. Degen tetap menanggung porsi lebih besar karena biasanya TVL-nya lebih kecil, ditambah menerima limpahan (*overflow*) jika Prime menyentuh batas *Protection Floor*. Degen Vault dapat tergerus hingga $0 (memicu *Epoch Reset*).
*   **Lockup Period:** 2 Hari (172.800 detik). Uang yang disetor akan dikunci selama 2 hari kalender absolut tanpa celah pintas.

### 🔵 Prime Vault (Capital Protected Vault)
Diperuntukkan bagi institusi atau *whale* yang mengutamakan keamanan dan apresiasi nilai konstan.
*   **Kapasitas Maksimal (Porsi):** **$35.000.000** (70% dari Total TVL)
*   **Insentif Keuntungan:** Mendapatkan sisa 1x porsi profit reguler. Kenaikan nilai *shares* berjalan perlahan namun memiliki resistensi tinggi terhadap kejatuhan tajam.
*   **Proteksi Ekstrem:** Dilindungi secara matematis dari risiko kebangkrutan (Lihat detail *Capital Protection* di Bab 3).
*   **Lockup Period:** 5 Hari (432.000 detik). Uang yang disetor dikunci lebih lama demi menjaga stabilitas cadangan kas bursa. Deposit baru menggunakan sistem **Weighted Average Deposit Time**, sehingga tambahan modal kecil tidak akan me-reset seluruh waktu tunggu dari saldo lama yang jauh lebih besar.

---

## 3. 🛡️ Proteksi Sistemik & Manajemen Risiko

Untuk menjaga roda ekonomi *smart contract* tetap berputar stabil, ekosistem dibekali dengan tembok pertahanan matematis:

### A. Vault Utilization Cap (Batas Maksimal Eksekusi) : `80%`
*   Berlaku saat *trader* **MEMBUKA** posisi.
*   Sistem tidak akan mengizinkan pembukaan posisi baru jika uang tunai yang sedang terpakai untuk menahan posisi berjalan (*Open Interest*) menyentuh **80%** dari saldo Vault. Sisa **20%** adalah dana kas (*Cash Reserve*) suci yang dijamin tersedia agar para LP selalu bisa menarik (*Withdraw*) aset mereka kapanpun tanpa kegagalan transaksi (*Revert*).

### B. Proportional Shared-Loss with Prime Protection Floor : `60%`
*   Berlaku saat *trader* **MENUTUP** posisi (Membawa kemenangan), maupun saat distribusi untung/rugi *Funding Rate*.
*   Kerugian akibat kemenangan *trader* dibagi secara **proporsional** antara Degen Vault dan Prime Vault berdasarkan rasio TVL masing-masing. Jadi kedua pihak LP ikut menanggung secara adil.
*   Namun, Prime Vault dilindungi oleh *Protection Floor*: **Minimum 60% dari Total Asset Prime Vault dikunci absolut** dan tidak dapat disedot. Jika porsi proporsional Prime melebihi batas ini, kelebihan (*overflow*) dialihkan ke Degen Vault.
*   **Circuit Breaker (40%):** Jika total kerugian kumulatif Prime Vault mencapai **40% dari Total Deposit Historis**, *Smart Contract* otomatis mem-pause seluruh DEX untuk melindungi modal LP. Batas ini dilacak seumur hidup (historical absolute) dan tidak akan me-reset harian.

### C. Emergency Auto-Deleveraging (ADL) : `95%`
*   Garis pertahanan krisis likuiditas paling ekstrem. 
*   Jika karena satu dan lain hal pergerakan pasar menyebabkan utilitas kas Vault melonjak melebihi **95%**, *Keeper Bot* diberikan wewenang membunuh posisi-posisi menguntungkan (*profitable*) milik *trader* secara paksa untuk mengembalikan likuiditas ke zona aman.

### D. Auto-Scaling Withdrawals (Pencairan Likuiditas Dinamis)
*   Jika seorang *Liquidity Provider* (LP) mencoba menarik dana lebih besar dari *Available Liquidity* (kas kasual yang sedang tidak dipakai oleh *trader*), sistem tidak akan menggagalkan transaksi (*Revert*).
*   *Smart Contract* V1 secara otomatis akan mencairkan jumlah dana maksimal yang tersedia di brankas pada detik tersebut, lalu membiarkan sisa porsi saham (*shares*) LP tetap utuh berada di dalam Vault untuk ditarik nanti.

---

## 4. 🤖 Peran & Ekonomi Keeper Bot (`feederBot.cjs`)

Eksekusi otomatisasi platform dijalankan secara mandiri oleh satu **Unified Keeper Bot** yang menyala 24/7 di *server* VPS. Bot ini melakukan 3 siklus penyapu sekaligus setiap **2.5 detik**:

1.  **Eksekusi Pending Order:** Mengawal order *Limit*, *Stop Market*, *TWAP*, hingga *delayed Market Order*. Begitu harga pasar dari Pyth Oracle menyentuh angka target (`triggerPrice`), bot langsung memanggil fungsi `executeOrder` ke blockchain.
2.  **Take Profit & Stop Loss (TP/SL):** Memantau batas atas dan batas bawah posisi aktif para trader. Ketika target untung/rugi tercapai, bot memicu `executeTPSL` untuk menutup posisi secara otomatis.
3.  **Likuidasi Posisi Underwater:** Memindai tingkat kesehatan jaminan (*collateral ratio*) trader. Jika margin tidak lagi memenuhi syarat minimal, bot memicu `liquidate` untuk mengamankan kas pool.

### 💰 Mekanisme Biaya, Gas, & Imbalan (Fee Economics)
Sistem keuangan bot dirancang secara adil agar operator bot tidak pernah mengalami kerugian atau tekor saldo:
*   **Pemantauan 100% Gratis:** Aktivitas bot menyapu dan membaca harga setiap 2.5 detik adalah operasi *Read-Only* ke jaringan RPC, sehingga **tidak memakan gas fee sepeser pun (Rp 0 / 0 ARC)**.
*   **Biaya Eksekusi Dibayar User:** Saat *User* (Trader) memasang order, mereka diwajibkan menyertakan **Execution Fee (dalam koin ARC)** dan **Trading Fee (dalam USDC)** dari dompet mereka sendiri.
*   **Keeper Reward (Imbalan Bot):** Ketika bot mengeksekusi order nyata ke blockchain, bot mengeluarkan sedikit gas fee + **Biaya Verifikasi Pyth Oracle Dinamis** (biasanya sangat murah, misal `1 wei`, dan bot memiliki cadangan fallback `0.001 ARC` jika RPC sedang bermasalah). Saat transaksi berhasil, *smart contract* otomatis **mentransfer seluruh Execution Fee milik User tadi ke dompet Bot (`msg.sender`)** sebagai imbalan kerja keras bot (ini murni profit di luar biaya gas/Pyth)!
*   **Distribusi Fee Trading (USDC):** Dari total fee USDC yang dibayar trader, smart contract membaginya menjadi **70% ke Vault** (menaikkan dividen/harga token LP) dan **30% ke Treasury** (kas developer platform).

*(Catatan: Fungsi eksekusi ini beroperasi 100% Permissionless, artinya siapapun di seluruh dunia berhak menyalakan bot mereka sendiri dan berkompetisi mendapatkan imbalan eksekusi).*

---

## 5. ✨ Eksekusi Fungsional Tingkat Institusi

*   **Dynamic Skew-Based P2P Funding Rate:** Membuang beban sewa (Borrow Fee) menjadi 0% agar lebih ringan. Platform menerapkan *Continuous P2P Funding Rate* yang sangat dinamis berdasarkan rasio ketidakseimbangan *(skew)* antara Long dan Short (bukan berdasarkan rasio pemakaian Vault). Mayoritas akan langsung membayar Minoritas. Jika pasar 100% Long, mereka akan dikenakan fee maksimal (misal 0.0125% per jam) yang bisa langsung memberikan peluang profit *(arbitrase)* bagi siapapun yang berani masuk membuka posisi Short untuk menyeimbangkan pasar.
*   **Limit Order Discipline (0% Buffer):** Limit Order menggunakan ketepatan 100% tanpa buffer eksekusi prematur. Pesanan hanya terbuka jika harga pasar tepat menyentuh atau melewati target.
*   **Execution Buffer (Anti-Jarum) 0.3%:** Khusus untuk Stop Order, Take Profit (TP), dan Stop Loss (SL), terdapat buffer eksekusi 0.3% *(30 bps)* untuk melindungi trader dari gagal eksekusi *(revert)* saat volatilitas atau *market crash* mendadak.
*   **Harmonic Averaging & Strict Leverage Validation:** Perhitungan *entry* baru saat *trader* menambah posisi menggunakan rata-rata harmonik. Selain itu, sistem secara ketat mengkalkulasi dan memvalidasi *leverage gabungan* dari aset sebelum dan sesudah digabungkan, menepis segala manipulasi taktik penambahan posisi paksa dengan leverage di atas batas maksimal (maks `100x`).
*   **On-Chain Max Leverage Tiers:** Batas leverage diatur langsung di smart contract sesuai kelas volatilitas aset: **100x** untuk aset kripto utama (BTC, ETH, SOL) dan Forex; **50x** untuk Altcoins dan Komoditas (Emas/Perak); serta **20x** untuk Indeks Saham (S&P500, NASDAQ).
*   **TWAP (Time-Weighted Average Price):** Pemecah irisan order besar ke dalam rentang waktu terkalibrasi untuk meminimalkan dampak harga kuadratik.
*   **Dynamic Quadratic Price Impact (Senjata Anti-Whale):** *Price Impact* dihitung secara eksponensial (Pangkat Dua) berdasarkan besaran posisi relatif terhadap Max OI. Pesanan kecil hampir tidak terasa, namun pesanan raksasa *(whale)* akan langsung dicekik penalti yang mematikan. Sistem ini juga **Skew-Aware**: Jika paus membuka arah yang makin memiringkan pasar, ia mendapat penalti penuh. Jika *trader* membuka posisi untuk menyeimbangkan pasar, ia mendapat **Diskon Price Impact 50%**.
*   **Partial Close (Penutupan Sebagian):** Fleksibilitas tingkat lanjut di mana *trader* dapat menutup sekian persen dari posisi aktif mereka. *Smart contract* akan secara presisi menghitung ulang sisa *collateral*, mengamankan untung/rugi pada porsi yang ditutup, dan memperbarui harga likuidasi secara instan tanpa mengganggu sisa posisi.

---

## 6. 🔐 Lapis Pertahanan Anti-Eksploitasi Jaringan

1.  **Anti-Flash Loan & MEV (5-Second Cooldown):** Posisi yang baru saja dibuka mustahil ditutup atau dikutak-katik dalam waktu 5 detik. Mengeliminasi total eksploitasi serangan *Flash Loan* dalam satu siklus blok.
2.  **Oracle Confidence Interval:** Sistem menolak berdagang jika selisih rentang tebakan *(Confidence Interval)* dari data Pyth melebihi batas rasional akibat badai volatilitas eksternal.
3.  **Strict CEI (Checks-Effects-Interactions):** Semua perpindahan uang (USDC) dieksekusi murni di akhir baris setelah penurunan OI dan pencatatan PnL, menutup lubang maut *Reentrancy Attack*.
4.  **Anti-Donation Attack (ERC-4626):** Setoran deposit $1.000 pertama dalam Vault dikorbankan (*burnt*) permanen untuk mencegah eksploitasi inflasi rasio harga *shares*.
5.  **Automated Epoch Bankruptcy:** LP tidak mewarisi "utang" dari keruntuhan harga. Jika sebuah Vault tergerus hingga saldo $0 akibat kemenangan beruntun *trader*, *shares* akan direset bersih menjadi rasio 1:1 di Epoch baru.
6.  **2-Step Ownership Transfer (Keamanan Admin):** Sistem pergantian *Owner* (hak admin *smart contract*) menggunakan perlindungan 2-Langkah. `transferOwnership` harus dilanjutkan dengan verifikasi `acceptOwnership` oleh dompet tujuan. Menutup total risiko *"fat-finger"* (salah ketik alamat) yang bisa menyebabkan DEX terkunci selamanya.
