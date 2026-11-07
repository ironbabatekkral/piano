# Piyano

Bilgisayar klavyesiyle çalınan, tarayıcıda çalışan bir piyano ve nota öğreticisi.

**Canlı:** https://ironbabatekkral.github.io/piano/

Kurulum, sunucu ya da hesap gerekmez. Ses tarayıcıda Web Audio API ile üretilir.

## Özellikler

- 88 tuşlu piyano (A0–C8), fare ile tıklama ve sürükleyerek glissando
- Klavye iki ele bölünmüş, her el gerçek piyano şeklinde: beyaz tuşlar bir harf satırında, siyahlar üstündeki satırda
  - Sol el: beyaz `Z X C V B N M`, siyah `S D G H J`
  - Sağ el: beyaz `Y U I O P [ ] \`, siyah `7 8 0 - =`
- **Tuş atamaları:** her notanın tuşunu kendin seçebilirsin
- **Öğretici:** çalınacak tuşlar ekranda yanar, doğru basınca sıradakine geçer
  - Oto oktav: klavyeyi parçanın aralığına kendisi kaydırır
  - Oto pedal: parçanın notalarındaki pedal işaretlerine göre sustain pedalına basar; işaret yoksa basmaz
  - Döngü: parça bitince baştan başlar
- **Kendi parçaların:** notaları yazıp kaydedebilirsin

| Tuş | Görev |
|---|---|
| ← → | oktav |
| ↑ ↓ | vuruş gücü |
| Boşluk | sustain pedalı (basılı tut) |
| Esc | tüm sesleri kes |

## Kendi parçanı yazmak

"Kendi parçanı yap" bölümüne notaları boşlukla ayırarak yaz:

```
Do4 Re4 Mi4 Do4+Mi4+Sol4
Ped C4+E4+G4 Ped F4+A4+C5 * G4 E4
```

- `+` aynı anda basılacak notalar
- `#` diyez (`Fa#4`), `b` bemol (`Sib3`, `Eb5`)
- Oktav yazılmazsa 4 sayılır
- `Ped` sustain pedalına basar (zaten basılıysa değiştirir: önceki sesler susar), `*` pedalı kaldırır; ikisi de kendisinden sonraki notada uygulanır
- Pedal işareti yazılmayan parçada pedala basılmaz

## Verilerin nerede tutulur

Kaydettiğin parçalar, tuş atamaların ve ayarların **yalnızca kendi tarayıcında** (`localStorage`) saklanır. Hiçbir sunucuya, bu repoya ya da GitHub'a gönderilmez. Tarayıcı verilerini silersen bunlar da silinir.

## Yerelde çalıştırma

Repoyu indirip `index.html` dosyasına çift tıkla. Derleme adımı ya da bağımlılık yok.

## Telif hakkı / Kaldırma talebi

"Popüler intro'lar" listesindeki parçalar, kişisel çalışma amacıyla yazılmış kısa nota dizileridir. Ses kaydı, nota kâğıdı ya da şarkı sözü içermez. Bu parçaların hakları sahiplerine aittir.

Bir parçanın hak sahibiysen ve kaldırılmasını istiyorsan, **lütfen DMCA bildirimi göndermeden önce** [bir issue aç](https://github.com/ironbabatekkral/piano/issues/new?title=Kaldırma%20talebi). Parça gecikmeden kaldırılır.

### Copyright / Takedown requests

The pieces under "Popüler intro'lar" (popular intros) are short note sequences written for personal practice. They contain no audio, sheet music or lyrics. All rights belong to their respective owners.

If you hold the rights to one of these pieces and want it removed, **please [open an issue](https://github.com/ironbabatekkral/piano/issues/new?title=Takedown%20request) before filing a DMCA notice**. It will be taken down promptly.
