-- 为 subscriptions 表添加 PayPal 相关字段

-- 添加 paypal_order_id 字段（当前待支付/支付中的 PayPal 订单 ID）
ALTER TABLE subscriptions ADD COLUMN paypal_order_id TEXT;

-- 添加 paypal_capture_id 字段（支付完成后的 Capture ID）
ALTER TABLE subscriptions ADD COLUMN paypal_capture_id TEXT;

-- 添加 updated_at 字段（订阅更新时间）
ALTER TABLE subscriptions ADD COLUMN updated_at TEXT;

-- 更新 existing rows 的 updated_at
UPDATE subscriptions SET updated_at = created_at WHERE updated_at IS NULL;
