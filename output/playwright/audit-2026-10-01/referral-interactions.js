async (page) => {
  const evidence = [];
  const drawer = page.getByRole('dialog', {name:'القائمة الجانبية'});
  evidence.push({flow:'mobile drawer after open', bounds:await drawer.boundingBox(), overflow:await page.evaluate(()=>document.body.style.overflow)});
  await page.getByRole('button',{name:'إغلاق القائمة الجانبية',exact:true}).click();
  for (const name of ['أحمد مروان','ياسمين نور','عمر خالد (الجذر 2)','محمد عبد الله (الجذر 1)']) {
    await page.getByRole('button',{name,exact:true}).click();
    evidence.push({flow:'referral root',name,text:await page.locator('main').innerText()});
  }
  await page.getByRole('textbox',{name:'تصفية أعضاء فريق الحساب المختار'}).fill('ياسمين');
  evidence.push({flow:'filter within relative levels',text:await page.locator('main').innerText()});
  await page.getByRole('textbox',{name:'تصفية أعضاء فريق الحساب المختار'}).fill('');
  return evidence;
}
