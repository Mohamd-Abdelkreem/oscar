async (page) => {
  await page.setViewportSize({width:1440,height:844});
  const response=await page.goto('http://localhost:3000/admin');
  await page.getByRole('heading',{name:'نظرة عامة على العمليات',exact:true}).waitFor({state:'visible'});
  return {preview:page.url(),status:response.status(),heading:await page.getByRole('heading',{name:'نظرة عامة على العمليات',exact:true}).innerText()};
}
