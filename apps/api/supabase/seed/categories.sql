insert into categories (name) values
('食費'),
('外食'),
('日用品'),
('娯楽品'),
('遊び'),
('交通費'),
('衣類・美容'),
('薬・病院'),
('書籍'),
('交際費'),
('ギャンブル'),
('税金'),
('固定費'),
('その他')
on conflict (name) do nothing;
