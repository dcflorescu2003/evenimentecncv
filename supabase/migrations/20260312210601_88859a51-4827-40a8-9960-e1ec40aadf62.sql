
INSERT INTO profiles (id, first_name, last_name, username)
VALUES 
  ('71144690-e526-4a27-9e96-9f29cd74d765', 'Cosmin', 'Florescu', 'florescu.cosmin'),
  ('8d8a86be-b1df-4350-b24a-5f8cb5b85388', 'Cosmin', 'Florescu', 'cosmin.florescu')
ON CONFLICT (id) DO NOTHING;
