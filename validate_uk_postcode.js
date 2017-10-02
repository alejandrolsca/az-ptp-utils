const validateUKPostcode = (postcode) => {
  const alpha1 = "[abcdefghijklmnoprstuwyz]"
  const alpha2 = "[abcdefghklmnopqrstuvwxy]"
  const alpha3 = "[abcdefghjkpmnrstuvwxy]"
  const alpha4 = "[abehmnprvwxy]"
  const alpha5 = "[abdefghjlnpqrstuwxyz]"

  const pcexp = new Array()
  pcexp.push(new RegExp("^(" + alpha1 + "{1}" + alpha2 + "?[0-9]{1,2})(\\s*)([0-9]{1}" + alpha5 + "{2})$", "i"))
  pcexp.push(new RegExp("^(" + alpha1 + "{1}[0-9]{1}" + alpha3 + "{1})(\\s*)([0-9]{1}" + alpha5 + "{2})$", "i"))
  pcexp.push(new RegExp("^(" + alpha1 + "{1}" + alpha2 + "{1}" + "?[0-9]{1}" + alpha4 + "{1})(\\s*)([0-9]{1}" + alpha5 + "{2})$", "i"))
  pcexp.push(/^(GIR)(\s*)(0AA)$/i)
  pcexp.push(/^(bfpo)(\s*)([0-9]{1,4})$/i)
  pcexp.push(/^(bfpo)(\s*)(c\/o\s*[0-9]{1,3})$/i)
  pcexp.push(/^([A-Z]{4})(\s*)(1ZZ)$/i)
  let valid = false
  for (let i = 0; i < pcexp.length; i++) {
    if (pcexp[i].test(postcode)) {
      pcexp[i].exec(postcode)
      postcode = RegExp.$1.toUpperCase() + " " + RegExp.$3.toUpperCase()
      postcode = postcode.replace(/C\/O\s*/, "c/o ")
      valid = true
      break
    }
  }
  if (valid) { return postcode } else return false
}
module.exports = validateUKPostcode