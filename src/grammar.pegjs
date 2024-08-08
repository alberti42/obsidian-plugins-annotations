{
  function addToDictionary(dict, block) {
    if (block.id) {
      const { id, ...rest } = block; // Destructure to remove the id property
      dict[id] = rest; // Add the rest of the properties to the dictionary
    }
    return dict;
  }
  
  const mandatory_tags = ['id'];
}

main
  = blocks:block* { 
      const dictionary = blocks.reduce((acc, block) => {
      	if(block){ addToDictionary(acc, block); }
        return acc;
      }, {});
      return dictionary;
  }

block
  = annotation_block / loose_line

annotation_block
  = name:plugin_name tags:tag+ begin_cmd anno:annotation_text end_cmd {

  	const tags_dict = tags.reduce((acc, block) => {
      	acc[block.tag] = block.arg;
        return acc;
      }, {});

    let integral = true;
	for (let tag of mandatory_tags) {
	  if(!(tag in tags_dict)) {
        integral = false;
		break;
      }
	}

    if(integral) {
      return {
        id: tags_dict['id'],
        name: name,
        anno: anno,
        type: tags_dict['type'] || 'markdown',
      };
    } else {
      return null;
    }
  }

plugin_name
  = "#" _ @name:$not_newline newline+

id_field
  = "<!--" _* "id:" _ id:$(!"-->" !_ .)+ _* "-->" newline+ { return { 'tag': 'id', 'arg': id }; }

type_field
  = "<!--" _* "type:" _* type:valid_types _* "-->" newline+ { return { 'tag': 'type', 'arg': type }; }
    
tag
  = id_field / type_field
  
valid_types
  = $("markdown"i / "html"i / "text"i) { return text().toLowerCase(); }

begin_cmd
  = $("<!--" _* "BEGIN" _* "ANNOTATION" _* "-->" newline+)

end_cmd
  = $(newline+ "<!--" _* "END" _* "ANNOTATION" _* "-->" newline+)

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
