async (page) => {
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'فتح القائمة الجانبية',exact:true}).click();
  await page.getByRole('button',{name:'إغلاق القائمة الجانبية',exact:true}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'إغلاق القائمة الجانبية',exact:true}).click();
  return {flow:'mobile menu open and close',passed:true};
}
