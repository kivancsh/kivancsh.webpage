# Kıvanç Karademir · kişisel plak arşivi

Hayatın yıllarını plaklar olarak anlatan kişisel blog. Her plak bir dönem; plağın içine girince o dönemin yazısı açılır.

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:5178
npm run build    # statik çıktı: dist/ (+ her plak için önizleme sayfası, sitemap.xml)
npm test         # duman testi: plağa gir, alt plağa geç, dil değiştir, kapat (Playwright)
npm run og       # paylaşım görseli public/content/og.jpg (önce npm run dev açık olmalı)
```

İlk `npm test` öncesinde bir kez `npx playwright install chromium` gerekir. Aynı test GitHub'da her push'ta yayından önce çalışır; geçmezse site eski hâliyle kalır.

Yayın: `main` dalına her push'ta `.github/workflows/deploy.yml` siteyi derleyip GitHub Pages'e yükler (https://kivancsh.github.io/kivancsh.webpage/). Bunun için depo ayarlarında Settings → Pages → Source: **GitHub Actions** seçili olmalı.

Netlify alternatifi: depoyu bağlarsanız `netlify.toml` derlemeyi kendisi yapar.

## İçerik nasıl düzenlenir (koda dokunmadan)

Tüm içerik `public/content/` altında:

- `records.json`: site adı, unvan (`subtitle`), iletişim (`contact`: e-posta, LinkedIn, özgeçmiş PDF yolu), plakların sırası, yılları, adları, renkleri ve alt plakları.
- `cv/Kivanc-Karademir-CV.pdf`: sağ üstteki ve her yazının sonundaki "Özgeçmiş" bağlantısının açtığı dosya. Yenisini aynı adla koymak yeterli.
- `posts/*.md`: her plağın yazısı. `posts/<plak>/*.md`: o plağın alt plaklarının yazıları.

Bir plak alanları:

| alan | ne işe yarar |
| --- | --- |
| `slug` | adres: `#/slug` |
| `years` | etikette ve başlıkta görünen yıl/dönem, ör. `2010–2015` veya `2016` |
| `name` | plağın adı |
| `accent` | dönemin vurgu rengi (taban her zaman vinil siyahı kalır) |
| `post` | yazının Markdown dosyası |
| `children` | (isteğe bağlı) alt plaklar: `slug`, `name`, `post`, isteğe bağlı `accent` |

Herhangi bir plağa `children` eklemek, onun altında mini plak yelpazesini otomatik açar.

Markdown'da desteklenenler: `## ara başlık`, `### küçük başlık`, `> alıntı` (son satır `— kişi` olursa imza olur), `- liste`, `![açıklama](resim-yolu)` (yer tutucu için `placeholder`), `**kalın**`, `*italik*`, `[bağlantı](https://...)` ve kronoloji bloğu:

````
```timeline
2012 | Olay
2014 | Başka bir olay
```
````

Görselleri `public/content/img/` gibi bir klasöre koyup `![Açıklama](content/img/foto.jpg)` diye ekleyebilirsiniz. Ön bilgi (`---` arası) içindeki `title` ve `lede` sayfanın başlığı ve giriş cümlesidir. Metne `[Yer tutucu]` yazılırsa işaretli görünür; duman testi yayında yer tutucu kalmasına izin vermez.

## Sayfa davranışı

- Ana plak sayfası o dönemin **genel özeti**dir. Alt plağı olan bir plağın özet sayfasının sonunda "Bu plağın parçaları" listesi bulunur; her alt plak kendi yazısını açar.
- Adresler: `#/` sergi, `#/universite-tecrubelerim` dönem özeti, `#/universite-tecrubelerim/stajlar` alt plak. Geri tuşu ve paylaşılan bağlantılar çalışır.
- Ana sayfada yalnızca ana plaklar durur; alt plaklar, ana plakları ortaya gelince altında açılır.

## Özel bloklar

Markdown içinde şu bloklar da kullanılabilir:

````
```roles
content/logos/turkcell.webp | Turkcell | Yetenek Programı | not 1 ; not 2 | Haz 2021 – Ağu 2021
 | DAÜ Endüstri Mühendisliği Kulübü | Yönetim Kurulu Başkanı | logo yoksa baş harfler gösterilir
```

```stats
1447 | Katılımcı | Etkinlik proje liderliği
```

```travelmap
FI
SE
```
````

- `roles`: logo kartları. Sütunlar: logo | kurum | görev | notlar (`;` ile ayrılır) | tarih. Tarih isteğe bağlıdır ve unvanın altında küçük bir satır olarak görünür. Altıncı sütuna bir görsel yazılırsa (`… | tarih | content/img/…webp`) kart üzerine gelince ya da tıklanınca dönüp o görseli gösterir (Stajlar'daki belgeler ve fotoğraflar). Dörtten fazla satır olunca ızgara olur. Logolar `public/content/logos/` içinde, WebP ve en fazla 360 piksel genişlikte.
- `stats`: ekrana gelince sayan büyük rakamlar.
- `logosphere`: yazının arka planında yavaşça dönen logo küresi (Kulüp Etkinlikleri sayfasında). Her satır `logo | ad`; her logo kürede bir kez yer alır ve küre ekrana yayılır. Logolar oranları ne olursa olsun aynı alanı kaplar; ince bir yazı logosu ile yuvarlak bir amblem aynı büyüklükte görünür. Logolar en fazla %40 görünürlükte (telefonda %28), arkadakiler daha soluk. Logoların arka planı saydam olmalı.
- `stats` satırında sayı boş bırakılırsa (`| Ekip Yönetimi |`) yazının kendisi öne çıkan madde olarak gösterilir.
- `photos inline`: bir bölümün içinde, yazının altında duran iki fotoğraflık küçük set (Futbol bölümünde).
- `photos`: modern fotoğraf bloğu (Hobiler sayfasının sonunda). İsteğe bağlı ilk satır `## başlık`, sonra her satır `görsel GENxYÜK | açıklama`. Üç fotoğrafta ilki solda uzun durur; kareler kaydırınca aşağıdan açılır, üzerine gelince yakınlaşır.
- Tek fotoğraf: `![açıklama](content/img/klasör/foto.webp 1200x800)`. Fotoğraf kırpılmadan kendi oranında gösterilir; boyut yazmak sayfanın yüklenirken kaymasını önler.
- `gallery`: yuvarlak fotoğraf galerisi (Keşif & Seyahat sayfasında). Her satır: `görsel | başlık | yer`. Kartlar bölüm görününce dağınık hâlden sıraya, sonra çembere dizilir; fareyle ya da telefonda parmakla yaklaşınca dönüp dışa eğilir; sürükleyince halka kadran gibi döner; tıklanınca o fotoğraf büyür ve başlığı belirir, boşluğa tıklamak ya da Esc geri döndürür. Fotoğraflar `public/content/img/seyahat/` içinde, WebP ve en fazla 960 piksel; konum (GPS) bilgisi silinmiş olarak.
- `travelmap`: Türkiye'den uçuşlu dünya haritası. Tanımlı ülkeler: FI, SE, NO, RS, MK, KKTC. Yeni ülke için `src/travel/travel.js` (ülke, başkent) ve `src/travel/flags.js` (bayrak) dosyalarına bir satır eklenmesi gerekir.
- Ön bilgide `layout: hobbies`: her `##` başlık kendi renk ve animasyonuyla tam ekran bir bölüm olur (Fitness, Yapay Zeka, Futbol, Müzik temaları hazır).

## Müzik

Müzik yalnızca Spotify'ın kendi oynatıcısıyla çalar. Her sayfanın şarkısı `records.json` içindeki `music` alanıyla belirlenir: `spotify` (Spotify şarkı adresi `spotify:track:…`), `title`, `artist`. Ana sayfanınki `site.music`; alt plakta şarkı yoksa ana plağınki, ana plakta yoksa ana sayfanınki çalar. Bir şarkının başında sessizlik varsa `"start": 4` gibi bir alanla şarkı ilk açılışta o saniyeden başlar (Let It Happen'da kullanılıyor).

- Tarayıcıda Spotify'a giriş yapmış ziyaretçiler şarkının tamamını dinler. Giriş yapmamış ziyaretçiler Spotify'ın 30 saniyelik önizlemesini dinler; önizleme döngüde çalar ve `start` ona uygulanmaz.
- Sayfa değişince şarkı da değişir; bir sayfaya geri dönülünce o sayfanın şarkısı kaldığı saniyeden devam eder (ziyaret boyunca hatırlanır, sayfa yenilenince sıfırlanır).
- Tarayıcılar sesli otomatik oynatmayı engellediği için müzik ziyaretçinin ilk tıklamasında/dokunuşunda başlar. Ziyaretçi durdurursa kendiliğinden tekrar başlamaz. Telefon ve tablette sağ üstteki müzik düğmesi hafifçe nabız gibi atar ve altında "♪ Müziği aç" notu durur; müzik başlayınca ikisi de kaybolur. Düğmeye dokununca açılan küçük çalar 4 saniye sonra kendiliğinden kapanır, müzik çalmaya devam eder.
- iPhone, iPad ve Mac'te Safari, Spotify'ın çalmaya başlaması için Spotify'ın kendi oynatıcısına dokunulmasını ister. Bu yüzden orada şarkı kendiliğinden başlamazsa küçük çalar kendiliğinden açılır; Spotify'ın çal düğmesine tek dokunuş yeter. Bu, her sayfa değişiminde tekrarlanabilir.
- 30 saniyelik önizleme ya da şarkı bittiğinde başa dönüp çalmaya devam eder.
- Spotify'ın oynatıcısında ses seviyesi ayarı yoktur; şarkı cihazın ses seviyesinde çalar.
- Spotify'a ulaşılamazsa (engelli ağ, eklenti) 12 saniye içinde çalar kendini gizler; site müziksiz devam eder.

## Harita verisi

`public/content/map/world.json` (~115 KB), Natural Earth verisinden `npm run map` ile üretilir; yeniden üretmek gerekmez. Avrupa ve çevresi ayrıntılı (sadeleştirilmiş 50m), dünyanın geri kalanı kaba (110m) çizilir, çünkü harita yalnızca Avrupa'ya yakınlaşır.

## Yazı tipleri

Fraunces (başlık ve metin), Big Shoulders Display (büyük rakamlar) ve IBM Plex Mono (küçük etiketler) siteyle birlikte gelir; Google Fonts'a istek gitmez. `npm run fonts` bu yazı tiplerini sitenin kullandığı karakterlere indirger (`src/fonts/`, `src/fonts.css`; 408 KB → 175 KB). Yazılara yeni bir dilin harflerini (ör. ñ, ø) eklerseniz bu komutu bir kez çalıştırın.

## Hız

- Açılışta 3B sahnenin kodu ve içerik dosyası HTML gelir gelmez indirilmeye başlar; yazı tipleri açılışı bekletmez (geç gelirlerse plak etiketleri yeniden çizilir).
- Ana sayfa açıldıktan sonra tarayıcı boşta kaldığında bütün sayfaların fotoğrafları ve logoları arka planda ikişer ikişer indirilir; hangi sayfaya girilirse girilsin fotoğraflar hazırdır. Veri tasarrufu açıksa ya da bağlantı 2G ise bu yapılmaz.

## Arama motorları ve bağlantı önizlemeleri

Uygulama `#/` adresleriyle çalıştığı için `npm run build` sonunda `scripts/prerender.mjs` her plak ve alt plak için küçük bir statik sayfa üretir: `/kariyer-yolculugum/`, `/en/kariyer-yolculugum/` gibi. Bu sayfalarda başlık, açıklama ve paylaşım görseli etiketleri ile yazının düz metni bulunur; ziyaretçi açar açmaz sitedeki aynı sayfaya geçer. LinkedIn'de paylaşırken bu adresleri kullanın, ör. https://kivancsh.github.io/kivancsh.webpage/kariyer-yolculugum/

## Kod düzeni

- `src/main.js`: açılış, giriş (sürükleme, tekerlek, klavye), döngü.
- `src/navigation.js`: adresler ve geçmiş (geri tuşu, paylaşılan bağlantılar).
- `src/transitions.js`: plağa dalış / çıkış ve yazılar arası geçiş.
- `src/post.js`, `src/markdown.js`: yazı sayfası. `src/contact.js`: iletişim bağlantıları.

## Dil (Türkçe / English)

Sağ üstteki TR / EN düğmesi tüm siteyi değiştirir. Seçim tarayıcıda hatırlanır ve adrese `?lang=en` olarak eklenir, böylece İngilizce bir bağlantı doğrudan İngilizce açılır. İlk ziyarette tarayıcı dili Türkçe değilse ve İngilizceyse site İngilizce açılır.

- Arayüz metinleri: `src/i18n.js`.
- Plak adları, yıllar, kısa etiketler ve alt başlık: `records.json` içinde `{"tr": "…", "en": "…"}`.
- Yazılar: Türkçesi `x.md`, İngilizcesi yanındaki `x.en.md`. İngilizce dosya yoksa Türkçesi gösterilir.
- Spotify oynatıcısının kendi düğmeleri (ör. "Önizle") Spotify'a aittir ve ziyaretçinin tarayıcı diline göre değişir.
