INSERT INTO airlines (airline_id, name, code, country) VALUES
  (5, 'British Airways', 'BA', 'UK'),
  (6, 'Lufthansa', 'LH', 'Germany'),
  (7, 'Air France', 'AF', 'France'),
  (8, 'American Airlines', 'AA', 'USA'),
  (9, 'Delta Air Lines', 'DL', 'USA'),
  (10, 'United Airlines', 'UA', 'USA'),
  (11, 'El Al', 'LY', 'Israel')
ON CONFLICT (airline_id) DO NOTHING;
