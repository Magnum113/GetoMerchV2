-- Создаем функцию для безопасного удаления элемента очереди производства
-- Функция выполняет все операции в одной транзакции, что предотвращает ошибки внешнего ключа
CREATE OR REPLACE FUNCTION delete_production_queue_item(queue_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
  result JSONB;
BEGIN
  -- Проверяем, что элемент существует и имеет статус 'pending'
  IF NOT EXISTS (
    SELECT 1 FROM production_queue 
    WHERE id = queue_item_id AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Элемент очереди не найден или имеет неподходящий статус'
    );
  END IF;

  -- Обновляем все связанные order_items, устанавливая production_queue_id в NULL
  UPDATE order_items
  SET 
    production_queue_id = NULL,
    fulfillment_status = 'cancelled',
    fulfillment_notes = COALESCE(fulfillment_notes || E'\n', '') || 'Производство отменено: элемент очереди удалён'
  WHERE production_queue_id = queue_item_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Удаляем элемент очереди производства
  DELETE FROM production_queue
  WHERE id = queue_item_id;

  -- Возвращаем результат
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Элемент очереди производства успешно удалён',
    'updated_order_items', updated_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Добавляем комментарий для документации
COMMENT ON FUNCTION delete_production_queue_item(UUID) IS 
'Безопасно удаляет элемент очереди производства, обновляя связанные записи order_items в одной транзакции';
