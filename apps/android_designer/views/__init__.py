from vela.template_engine import render_template


def designer_view(params):
    return render_template('apps/android_designer/templates/designer.html',
        {'project_id':str(params.get('project_id') or '')},router=params['router'])


def register_routes(router):
    router.add('/android',designer_view,name='android',title='Interfaces Android',layout='blank',show_in_sidebar=False)
