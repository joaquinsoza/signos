-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    created_at INTEGER NOT NULL,
    last_active INTEGER NOT NULL,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    last_streak_date TEXT
);

-- Lessons table (predefined curriculum)
CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'greetings', 'family', 'food', 'numbers', etc.
    difficulty INTEGER DEFAULT 1, -- 1: beginner, 2: intermediate, 3: advanced
    required_level INTEGER DEFAULT 1,
    xp_reward INTEGER DEFAULT 10,
    order_index INTEGER DEFAULT 0
);

-- Lesson signs (many-to-many)
CREATE TABLE IF NOT EXISTS lesson_signs (
    lesson_id TEXT NOT NULL,
    glosa TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    PRIMARY KEY (lesson_id, glosa),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

-- User progress on lessons
CREATE TABLE IF NOT EXISTS user_lesson_progress (
    user_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    status TEXT DEFAULT 'locked', -- 'locked', 'available', 'in_progress', 'completed'
    score INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    completed_at INTEGER,
    PRIMARY KEY (user_id, lesson_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

-- Exercise attempts (for analytics)
CREATE TABLE IF NOT EXISTS exercise_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    lesson_id TEXT,
    exercise_type TEXT NOT NULL, -- 'matching', 'translation', 'build_phrase'
    question TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL, -- 0 or 1
    xp_earned INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    requirement_type TEXT NOT NULL, -- 'xp_total', 'streak_days', 'lessons_completed', etc.
    requirement_value INTEGER NOT NULL
);

-- User achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);

-- Chat history
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user', 'assistant'
    content TEXT NOT NULL,
    metadata TEXT, -- JSON with exercise data, signs shown, etc.
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insert default lessons
INSERT INTO lessons (id, title, description, category, difficulty, required_level, xp_reward, order_index) VALUES
('lesson_greetings_1', 'Saludos Básicos', 'Aprende a saludar en LSCh', 'greetings', 1, 1, 10, 1),
('lesson_greetings_2', 'Despedidas', 'Aprende a despedirte en LSCh', 'greetings', 1, 1, 10, 2),
('lesson_family_1', 'Familia Cercana', 'Mamá, papá, hermano, hermana', 'family', 1, 2, 15, 3),
('lesson_numbers_1', 'Números 1-10', 'Cuenta del 1 al 10 en LSCh', 'numbers', 1, 1, 10, 4),
('lesson_food_1', 'Alimentos Básicos', 'Agua, pan, leche, frutas', 'food', 2, 3, 20, 5),
('lesson_emotions_1', 'Emociones', 'Feliz, triste, enojado, cansado', 'emotions', 2, 4, 20, 6);

-- Insert lesson signs
INSERT INTO lesson_signs (lesson_id, glosa, order_index) VALUES
('lesson_greetings_1', 'HOLA', 1),
('lesson_greetings_1', 'BUENOS', 2),
('lesson_greetings_1', 'DÍAS', 3),
('lesson_greetings_1', 'CÓMO', 4),
('lesson_greetings_1', 'ESTÁS', 5),
('lesson_greetings_2', 'ADIÓS', 1),
('lesson_greetings_2', 'HASTA', 2),
('lesson_greetings_2', 'LUEGO', 3),
('lesson_greetings_2', 'GRACIAS', 4),
('lesson_family_1', 'MAMÁ', 1),
('lesson_family_1', 'PAPÁ', 2),
('lesson_family_1', 'HERMANO', 3),
('lesson_family_1', 'HERMANA', 4),
('lesson_numbers_1', 'UNO', 1),
('lesson_numbers_1', 'DOS', 2),
('lesson_numbers_1', 'TRES', 3),
('lesson_food_1', 'AGUA', 1),
('lesson_food_1', 'PAN', 2),
('lesson_food_1', 'LECHE', 3);

-- Insert default achievements
INSERT INTO achievements (id, name, description, icon, requirement_type, requirement_value) VALUES
('achievement_first_lesson', 'Primera Lección', 'Completa tu primera lección', '🎓', 'lessons_completed', 1),
('achievement_streak_3', 'Racha de 3 días', 'Practica 3 días seguidos', '🔥', 'streak_days', 3),
('achievement_streak_7', 'Racha de 7 días', 'Practica 7 días seguidos', '🔥', 'streak_days', 7),
('achievement_xp_100', 'Aprendiz', 'Alcanza 100 XP', '⭐', 'xp_total', 100),
('achievement_xp_500', 'Experto', 'Alcanza 500 XP', '⭐', 'xp_total', 500),
('achievement_xp_1000', 'Maestro', 'Alcanza 1000 XP', '⭐', 'xp_total', 1000);

