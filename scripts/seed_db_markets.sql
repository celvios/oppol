-- Insert test markets directly into database for Telegram bot
INSERT INTO markets (market_id, question, description, image, category) VALUES
(0, 'Will Bitcoin hit $100k by Q4 2025?', 'Predicting if BTC/USD will trade above $100,000 on major exchanges before Dec 31, 2025.', 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800', 'Crypto'),
(1, 'Will Ethereum flip Bitcoin in market cap in 2025?', 'The Flippening: Will ETH market cap exceed BTC market cap at any point in 2025?', 'https://images.unsplash.com/photo-1622630998477-20aa696fab05?w=800', 'Crypto'),
(2, 'Who will win the 2026 World Cup?', 'Winner of the FIFA World Cup 2026 hosted in North America.', 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=800', 'Sports'),
(3, 'Will Apple launch a foldable iPhone in 2025?', 'Official release of a foldable screen iPhone model in calendar year 2025.', 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800', 'Tech')
ON CONFLICT (market_id) DO UPDATE 
SET question = EXCLUDED.question, 
    description = EXCLUDED.description, 
    image = EXCLUDED.image, 
    category = EXCLUDED.category;
