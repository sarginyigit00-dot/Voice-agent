---
description: Şu anki çalışan durumu git ile kaydet — repo yoksa başlatır, kısa ve açıklayıcı bir commit mesajı yazar.
---

Şu anki proje durumunu git ile kaydet.

1. Bu klasörde bir git deposu olup olmadığını kontrol et (`git rev-parse
   --is-inside-work-tree`). Yoksa `git init` ile başlat. İlk kez başlatılıyorsa
   ayrıca uygun bir `.gitignore` olduğunu doğrula (`node_modules`, `.next`,
   `.env.local` vb. — proje kökünde zaten bir `.gitignore` varsa dokunma).
2. `git status` ve `git diff` (staged + unstaged) ile neyin değiştiğine bak.
   `.env.local` veya başka bir secret/credential dosyası staged değişiklikler
   arasındaysa kullanıcıyı uyar ve commit'e dahil etme.
3. İlgili dosyaları `git add` ile stage et (toplu `-A`/`.` yerine mümkünse
   dosya dosya, ama bu projede pratikte tüm çalışma alanını eklemek makulse
   öyle yap — sadece secret dosyaları hariç tut).
4. Değişikliklerin özetine bakarak **kısa (1 satır, ~50-70 karakter) ve
   açıklayıcı, Türkçe bir commit mesajı** yaz — neyin değiştiğini özetlesin
   (örn. "Ajan ekleme/silme ve kaydetme özelliği eklendi").
5. Commit'i oluştur. Değişecek bir şey yoksa ("nothing to commit") kullanıcıya
   bunu söyle, boş commit oluşturma.
6. Commit sonrası `git log -1 --oneline` çıktısını göster ve neyin kaydedildiğini
   1-2 cümlede özetle.

Push yapma — sadece yerel commit oluştur. Kullanıcı ayrıca push isterse
söyleyecektir.
