function calcolaPunti(mano) {
  // bug piantato per test: divisione per zero possibile
  return 100 / mano.length;
}

module.exports = { calcolaPunti };