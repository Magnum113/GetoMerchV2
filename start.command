#!/bin/bash

# GetoMerch - Скрипт быстрого запуска проекта
# Двойной клик по этому файлу запустит проект и откроет браузер

cd "$(dirname "$0")"

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Запуск GetoMerch...${NC}"

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    # Пробуем найти node через Homebrew
    if [ -f "/opt/homebrew/bin/node" ]; then
        export PATH="/opt/homebrew/bin:$PATH"
    else
        echo -e "${YELLOW}⚠️  Node.js не найден. Установите Node.js через Homebrew:${NC}"
        echo "brew install node"
        exit 1
    fi
fi

# Проверяем наличие зависимостей
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
    if command -v pnpm &> /dev/null; then
        pnpm install
    elif command -v npm &> /dev/null; then
        npm install
    else
        echo -e "${YELLOW}⚠️  npm/pnpm не найден. Установите Node.js${NC}"
        exit 1
    fi
fi

# Очищаем старые процессы Next.js если есть
echo -e "${BLUE}🧹 Очистка старых процессов...${NC}"
pkill -f "next dev" 2>/dev/null || true
sleep 1

# Запускаем сервер разработки
echo -e "${GREEN}✅ Запуск dev-сервера на http://localhost:3000${NC}"
echo -e "${BLUE}📝 Логи сервера отображаются ниже. Нажмите Ctrl+C для остановки.${NC}"
echo ""

# Открываем браузер через 5 секунд
(sleep 5 && open http://localhost:3000/operations) &

# Запускаем Next.js
if command -v pnpm &> /dev/null; then
    pnpm run dev
elif command -v npm &> /dev/null; then
    npm run dev
else
    # Используем прямой путь к node если нужно
    /opt/homebrew/bin/node node_modules/.bin/next dev
fi

