# راهنمای راه‌اندازی دیتابیس MySQL و سرور PHP برای برنامه کارگاه
# Workshop Attendance & Payroll - MySQL & PHP Server Setup Guide

این پوشه شامل فایل‌های مورد نیاز برای راه‌اندازی سرور و همگام‌سازی بین دستگاه‌های مختلف (موبایل، لپ‌تاپ و تبلت) است.

---

## 📁 محتویات این پوشه:
1. `schema.sql`: کدهای ساخت جداول و دیتابیس MySQL با استاندارد `utf8mb4_unicode_ci` (پشتیبانی کامل از کردی و فارسی).
2. `config.php`: فایل تنظیمات اتصال به دیتابیس و کلید امنیتی API.
3. `api.php`: وب‌سرویس REST و موتور سینک دوطرفه جهت اتصال برنامه به هاست.

---

## 🚀 مراحل گام به گام راه‌اندازی روی هاست (cPanel / DirectAdmin):

### مرحله ۱: ساخت دیتابیس و کاربر در cPanel
1. وارد کنترل‌پنل هاست خود شوید.
2. به بخش **MySQL Databases** بروید.
3. یک دیتابیس جدید بسازید (مثلاً `yourusername_workshop`).
4. در همان صفحه، یک کاربر جدید بسازید (مثلاً `yourusername_wuser`) با یک پسورد قوی.
5. در بخش **Add User To Database**، کاربر را به دیتابیس اضافه کرده و گزینه **ALL PRIVILEGES** را تیک بزنید تا تمام دسترسی‌ها داده شود.

---

### مرحله ۲: ایمپورت فایل `schema.sql` در phpMyAdmin
1. در cPanel وارد **phpMyAdmin** شوید.
2. از منوی سمت چپ، روی نام دیتابیسی که در مرحله ۱ ساختید کلیک کنید.
3. از تب‌های بالا، روی **Import** کلیک کنید.
4. دکمه **Choose File** را بزنید و فایل `schema.sql` را انتخاب کنید.
5. روی دکمه **Go** یا **Import** در پایین صفحه کلیک کنید.
6. پیغام موفقیت سبز رنگ ظاهر می‌شود و جداول `workers`، `attendance_logs` و `settings` ساخته می‌شوند.

---

### مرحله ۳: تنظیم فایل `config.php`
فایل `config.php` را باز کنید و مشخصات دیتابیس مرحله ۱ را در آن بنویسید:
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'yourusername_workshop');
define('DB_USER', 'yourusername_wuser');
define('DB_PASS', 'پسوردی_که_در_مرحله_۱_گذاشتید');

// یک کلید امنیتی دلخواه انتخاب کنید (این کلید را باید در برنامه در گوشی هم وارد کنید):
define('API_SECRET_KEY', 'Workshop_Secret_Key_2026_ChangeMe');
```

---

### مرحله ۴: آپلود فایل‌ها در هاست
1. در هاست خود وارد **File Manager** شوید.
2. به پوشه `public_html` بروید.
3. می‌توانید یک پوشه مثلاً به نام `api` بسازید (`public_html/api/`).
4. فایل‌های `config.php` و `api.php` را داخل این پوشه آپلود کنید.

---

### مرحله ۵: تست اتصال در مرورگر
در مرورگر نشانی زیر را باز کنید:
`https://yourdomain.com/api/api.php?action=ping`
یا اگر ساب‌دامین ساخته‌اید:
`https://app.yourdomain.com/api.php?action=ping`

باید خروجی JSON به شکل زیر ببینید:
```json
{
    "success": true,
    "status": "connected",
    "message": "Workshop Server & MySQL Database are running smoothly.",
    "serverTime": "2026-09-17T22:30:00+03:00",
    "counts": {
        "workers": 4,
        "logs": 0
    }
}
```

---

### مرحله ۶: تنظیم در برنامه (موبایل و کامپیوتر)
1. در هدر برنامه روی آیکون **همگام‌سازی ابری (Cloud Sync)** کلیک کنید.
2. آدرس سرور را وارد کنید: `https://yourdomain.com/api/api.php`
3. کلید امنیتی (`API_SECRET_KEY`) که در `config.php` گذاشتید را وارد کنید.
4. دکمه **«تست اتصال»** را بزنید.
5. دکمه **«همگام‌سازی دستی (Sync Now)»** را بزنید تا تمام اطلاعات گوشی با سرور هماهنگ شود!
