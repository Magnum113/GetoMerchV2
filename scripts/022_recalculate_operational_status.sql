-- Миграция 022: Пересчет operational_status на основе реальных остатков
-- Предыдущая миграция 021 установила статусы без проверки остатков

-- Шаг 1: Сбросить все READY_TO_SHIP в PENDING для пересчета
UPDATE orders 
SET operational_status = 'PENDING'
WHERE operational_status = 'READY_TO_SHIP';

-- После выполнения этой миграции нужно вызвать API:
-- POST /api/operations/recalculate-status
-- для полного пересчета на основе логики OperationsService
