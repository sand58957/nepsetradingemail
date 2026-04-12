-- Add whatsapp_widget settings for floating WhatsApp button on landing page
INSERT INTO app_account_settings (key, value) VALUES
('whatsapp_widget', '{
    "enabled": true,
    "phone": "9779800000000",
    "message": "Hello! I would like to know more about your digital marketing services.",
    "position": "right",
    "label": "Chat with us"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
