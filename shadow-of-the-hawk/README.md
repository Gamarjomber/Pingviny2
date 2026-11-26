# Shadow of the Hawk

Репозиторій тримає гру не одним файлом на 39 МБ, а розібраною: код окремо, картинки й відео окремо.

```
src/template.html   код гри (~9 МБ) з плейсхолдерами @@ASSET:xxxx@@ замість картинок
assets/             376 файлів png/webp/webm + manifest.json
tools/split.py      розібрати готовий однофайловий білд  ->  src/ + assets/
tools/build.py      зібрати назад в один HTML            ->  dist/
```

## Зібрати гру одним файлом
```
python tools/build.py shadow-of-the-hawk.html
```
Результат: `dist/shadow-of-the-hawk.html` (байт-в-байт такий самий, як оригінал). `dist/` не комітиться.

## Нова версія білда (з іншого проєкту/Vite)
```
python tools/split.py шлях/до/нового-білда.html
```
Змінюється лише `src/template.html` і ті картинки, які справді змінились, тож історія git не роздувається.

## Релізи
Готовий HTML і великі ZIP не кладемо в git, а викладаємо у GitHub → Releases (ліміт 2 ГБ на файл).
