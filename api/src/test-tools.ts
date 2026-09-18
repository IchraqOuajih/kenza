import { searchProducts, checkStock } from './agent/tools/catalogue'
import { computePrice, enMad } from './agent/tools/pricing'

async function main() {
  console.log(await searchProducts('foulard'))
  console.log('stock REF-0001 :', await checkStock('REF-0001'))

  const d = await computePrice([{ ref: 'REF-0001', quantite: 2 }], 'Casablanca', 30)
  console.log('total :', enMad(d.total), 'MAD — remise appliquée :', d.remisePct, '%')
  console.log('remise plafonnée :', d.remisePlafonnee)

  process.exit(0)
}
main()