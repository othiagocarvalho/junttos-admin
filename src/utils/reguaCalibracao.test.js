import { describe, it, expect } from 'vitest'
import {
  marcasRegua, recuoDaMarca, rotuloParaDentro,
  CALIB_BORDA_MM, CALIB_TRACO_MM, CALIB_ROTULO_DENTRO_MM,
} from './reguaCalibracao'

// ─── Régua de calibração ────────────────────────────────────────────────────
// A régua mentiu por omissão e custou uma investigação inteira (25/08/2026).
// Ela andava de 5 em 5 e parava na última marca que coubesse: numa etiqueta de
// 33mm isso era o "30", deixando 3mm finais sem marcação. Na etiqueta impressa
// lê como "o conteúdo não alcança o picote", e foi diagnosticado como
// encolhimento de escala — que a medição no PDF de impressão depois mostrou
// não existir (a fileira sai a 100,2% do nominal).
//
// O disfarce funcionava porque o eixo VERTICAL não tem o problema: 25 é
// múltiplo de 5. Régua que fecha num eixo e para antes no outro é exatamente
// a aparência de uma imagem espremida na largura.

describe('marcasRegua — a régua tem de fechar na medida que ela mede', () => {
  it('inclui a medida total mesmo quando ela não é múltipla do passo', () => {
    expect(marcasRegua(33)).toEqual([0, 5, 10, 15, 20, 25, 30, 33])
  })

  it('não duplica a última quando a total JÁ é múltipla do passo', () => {
    // O eixo vertical (25mm) é este caso: nada muda lá.
    expect(marcasRegua(25)).toEqual([0, 5, 10, 15, 20, 25])
    expect(marcasRegua(40)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40])
  })

  it('a última marca é SEMPRE a medida total — é a pergunta que a régua responde', () => {
    for (const t of [12, 25, 33, 37.5, 40]) {
      expect(marcasRegua(t).at(-1)).toBe(t)
    }
  })

  it('medida menor que o passo ainda produz início e fim', () => {
    expect(marcasRegua(3)).toEqual([0, 3])
  })
})

describe('recuoDaMarca — a tinta da última marca não passa do picote', () => {
  it('a marca do fim recua a própria espessura; as outras não', () => {
    // O traço é desenhado para a direita do ponto: o do "0" ocupa 0,0→0,2mm,
    // dentro. Sem recuo, o dos 33mm ocuparia 33,0→33,2mm — tinta na etiqueta
    // vizinha. Medido antes da correção: traço da última marca em 33,01mm
    // numa caixa de 33mm.
    expect(recuoDaMarca(33, 33)).toBeGreaterThan(recuoDaMarca(30, 33))
    expect(recuoDaMarca(0, 33)).toBe(recuoDaMarca(30, 33))
  })

  it('vale para qualquer eixo — o vertical fecha em 25mm', () => {
    expect(recuoDaMarca(25, 25)).toBeGreaterThan(recuoDaMarca(20, 25))
  })
})

describe('rotuloParaDentro — número que sairia da etiqueta ou colidiria', () => {
  it('a marca do fim escreve para dentro — senão o número sai do picote', () => {
    expect(rotuloParaDentro(33, 33)).toBe(true)
    expect(rotuloParaDentro(25, 25)).toBe(true)
  })

  it('a vizinha da última também, quando o número colidiria com ela', () => {
    // Medido: "30" ocupava 30,3→32,0mm e o "33" para dentro ocupa
    // 31,0→32,7mm — 1mm de sobreposição bem onde a leitura importa.
    expect(rotuloParaDentro(30, 33)).toBe(true)
  })

  it('marca longe do fim usa o lado normal — nada muda no meio da régua', () => {
    expect(rotuloParaDentro(25, 33)).toBe(false)
    expect(rotuloParaDentro(0, 33)).toBe(false)
    // O eixo vertical (25mm) não tem marca apertada: 20 fica a 5mm do fim.
    expect(rotuloParaDentro(20, 25)).toBe(false)
  })

  it('o limiar cobre dois rótulos de dois dígitos lado a lado', () => {
    expect(CALIB_ROTULO_DENTRO_MM).toBeGreaterThanOrEqual(2 * 1.7)
  })
})

describe('as constantes de traço e borda são as que o CSS usa', () => {
  it('borda e traço têm espessura própria — o recuo depende das duas', () => {
    expect(recuoDaMarca(33, 33)).toBe(CALIB_BORDA_MM + CALIB_TRACO_MM)
    expect(recuoDaMarca(30, 33)).toBe(CALIB_BORDA_MM)
  })
})
