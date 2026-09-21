export function tablePresentation(table) {
  switch (table.state) {
    case 'loading': return {title:'正在查询你的桌位。',body:'请稍等一下。',button:'正在查询…',disabled:true};
    case 'locked': return {title:'桌位尚未开放查询。',body:table.reason === 'force_closed' ? '桌位查询暂未开放，请稍后再查看。' : `桌位将于 ${table.releaseDate}（马来西亚时间）开放查询。`,button:'刷新桌位状态',disabled:false};
    case 'available': return {title:'我们为你留好了位置。',body:`你的桌位：${table.assignment.name}`,button:'刷新桌位信息',disabled:false};
    case 'assignment_pending': return {title:'你的桌位正在安排中。',body:'桌位查询已开放。你的安排确认后会显示在这里。',button:'重新查询',disabled:false};
    case 'invalid_invitation': return {title:'无法确认这份邀请。',body:'邀请链接可能无效或已停用。请联系 Louis & Joyce 确认。',button:'邀请链接无效',disabled:true};
    default: return {title:'暂时无法查询桌位。',body:'请稍后重试，或联系 Louis & Joyce。',button:'重试 Table Check',disabled:false};
  }
}
export function renderTableCheck(table) {
  const view = tablePresentation(table);
  document.querySelector('#table-title').textContent = view.title;
  document.querySelector('#table-story').textContent = view.body;
  const button = document.querySelector('#table-check-button');
  button.textContent = view.button; button.disabled = view.disabled;
  document.querySelector('.table-scene').dataset.state = table.state;
}
