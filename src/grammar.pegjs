main
  = blocks:block* { return blocks; }

block
  = annotation_block1 / annotation_block / loose_line 

annotation_block1
  = name:plugin_name id:id_field type:type_field? begin_cmd anno:annotation_text end_cmd { return {
  	id: id,
    name: name,
  	anno: anno,
    type: type ? type : "markdown",
  } }

annotation_block
  = plugin_name newline+ id_field b:begin_cmd annotation_text end_cmd { console.log(b); return b; }

plugin_name
  = "#" _ @name:$not_newline newline+

id_field
  = "<!--" _* "id:" _ @$(!"-->" !_ .)+ _* "-->" newline+

type_field
  = "<!--" _* "type:" _* @valid_types _* "-->" newline+
  
valid_types
  = $("markdown"i / "html"i / "text"i) { return text().toLowerCase(); }

begin_cmd
  = $("<!--" _* "BEGIN ANNOTATION" _* "-->" newline+)

end_cmd
  = $("<!--" _* "END ANNOTATION" _* "-->" newline+)

annotation_text
  = $(!end_cmd .)*

loose_line
  = $(([^\n\r]* newline) / [^\n\r]+)
    
not_newline
  = [^\n\r]+

newline
  = [\n\r]

empty_line
  = $(_ [\n\r])
  
_ = [ \f\t\v\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]
