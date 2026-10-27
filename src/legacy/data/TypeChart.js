// Definición de multiplicadores de daño (Sinergias)
// 1.5x = Ventaja, 0.5x = Desventaja, 1.0x = Neutro
export const TypeChart = {
    "Tecnológico": { "Urbano": 1.5, "Cósmico": 0.5 },
    "Místico": { "Cósmico": 1.5, "Tecnológico": 0.5 },
    "Mutante": { "Místico": 1.5, "Urbano": 0.5 },
    "Cósmico": { "Mutante": 1.5, "Místico": 0.5 },
    "Urbano": { "Tecnológico": 1.5, "Mutante": 0.5 }
};