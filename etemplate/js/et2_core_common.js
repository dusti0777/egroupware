/**
 * eGroupWare eTemplate2 - JS Widget base class
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package etemplate
 * @subpackage api
 * @link http://www.egroupware.org
 * @author Andreas Stöckel
 * @copyright Stylite 2011
 * @version $Id$
 */

"use strict";

/**
 * IE Fix for array.indexOf
 */
if (typeof Array.prototype.indexOf == "undefined")
{
	Array.prototype.indexOf = function(_elem) {
		for (var i = 0; i < this.length; i++)
		{
			if (this[i] === _elem)
				return i;
		}
		return -1;
	};
}

/**
 * ET2_DEBUGLEVEL specifies which messages are printed to the console. Decrease
 * the value of ET2_DEBUGLEVEL to get less messages.
 */
var ET2_DEBUGLEVEL = 4;

function et2_debug(_level)
{
	if (typeof console != "undefined")
	{
		// Get the passed parameters and remove the first entry
		var args = [];
		for (var i = 1; i < arguments.length; i++)
		{
			args.push(arguments[i]);
		}

		if (_level == "log" && ET2_DEBUGLEVEL >= 4 &&
		    typeof console.log == "function")
		{
			console.log.apply(console, args);
		}

		if (_level == "info" && ET2_DEBUGLEVEL >= 3 &&
		    typeof console.info == "function")
		{
			console.info.apply(console, args);
		}

		if (_level == "warn" && ET2_DEBUGLEVEL >= 2 &&
		    typeof console.warn == "function")
		{
			console.warn.apply(console, args);
		}

		if (_level == "error" && ET2_DEBUGLEVEL >= 1 &&
		    typeof console.error == "function")
		{
			console.error.apply(console, args);
		}
	}
}

/**
 * Array with all types supported by the et2_checkType function.
 */
var et2_validTypes = ["boolean", "string", "float", "integer", "any", "js", "dimension"];

/**
 * Object whith default values for the above types. Do not specify array or
 * objects inside the et2_typeDefaults object, as this instance will be shared
 * between all users of it.
 */
var et2_typeDefaults = {
	"boolean": false,
	"string": "",
	"js": null,
	"float": 0.0,
	"integer": 0,
	"any": null,
	"dimension": "auto"
};

function et2_evalBool(_val)
{
	if (typeof _val == "string")
	{
		if (_val == "false")
		{
			return false;
		}
	}

	return _val ? true : false;
}

/**
 * Concat et2 name together, eg. et2_concat("namespace","test[something]") == "namespace[test][something]"
 * @param variable number of arguments to contact
 * @returns string
 */
function et2_form_name(_cname,_name)
{
	var parts = [];
	for(var i=0; i < arguments.length; ++i)
	{
		var name = arguments[i];
		if (typeof name == 'string' && name.length > 0)	// et2_namespace("","test") === "test" === et2_namespace(null,"test")
		{
			parts = parts.concat(name.replace(/]/g,'').split('['));
		}
	}
	var name = parts.shift();
	return parts.length ? name + '['+parts.join('][')+']' : name;
}

/**
* Resolve javascript pseudo functions in onclick or onchange:
* - egw::link('$l','$p') calls egw.link($l,$p)
* - form::name('name') returns expanded name/id taking into account the name at that point of the template hierarchy
* - egw::lang('Message ...') translate the message, calls egw.lang()
* - confirm('message') translates 'message' and adds a '?' if not present
* - window.open() replaces it with egw_openWindowCentered2()
* - xajax_doXMLHTTP('etemplate. replace ajax calls in widgets with special handler not requiring etemplate run rights
*
* @param string _val onclick, onchange, ... action
* @param string _cname name-prefix / name-space
* @return string
*/
function et2_js_pseudo_funcs(_val, _cname)
{
	if (_val.indexOf('egw::link(') != -1)
	{
		_val = _val.replace(/egw::link\(/g,'egw.link(');
	}

	if (_val.indexOf('form::name(') != -1)
	{
		_val = _val.replace(/form::name\(/g,_cname ? "et2_form_name('"+_cname+"'," : '(');
	}
	
	if (_val.indexOf('egw::lang(') != -1)
	{
		_val = _val.replace(/egw::lang\(/g,'egw.lang(');
	}

	// ToDo: inserts the styles of a named template
	/*if (preg_match('/template::styles\(["\']{1}(.*)["\']{1}\)/U',$on,$matches))
	{
		$tpl = $matches[1] == $this->name ? $this : new etemplate($matches[1]);
		$on = str_replace($matches[0],"'<style>".str_replace(array("\n","\r"),'',$tpl->style)."</style>'",$on);
	}*/

	// translate messages in confirm()
	if (_val.indexOf('confirm(') != -1)
	{
		_val = _val.replace(/confirm\((['"])(.*?)(\?)?['"]\)/,"confirm(egw.lang($1$2$1)+'$3')"); // add ? if not there, saves extra phrase
	}

	// replace window.open() with EGw's egw_openWindowCentered2()
	if (_val.indexOf('window.open(') != -1)
	{
		_val = _val.replace(/window.open\('(.*)','(.*)','dependent=yes,width=([^,]*),height=([^,]*),scrollbars=yes,status=(.*)'\)/,
			"egw_openWindowCentered2('$1', '$2', $3, $4, '$5')");
	}

	// replace xajax calls to code in widgets, with the "etemplate" handler,
	// this allows to call widgets with the current app, otherwise everyone would need etemplate run rights
	if (_val.indexOf("xajax_doXMLHTTP('etemplate.") != -1)
	{
		_val = _val.replace(/^xajax_doXMLHTTP\('etemplate\.([a-z]+_widget\.[a-zA-Z0-9_]+)\'/,
			"xajax_doXMLHTTP('"+egw.getAppName()+".$1.etemplate'");
	}
	return _val;
}

/**
 * Checks whether the given value is of the given type. Strings are converted
 * into the corresponding type. The (converted) value is returned. All supported
 * types are listed in the et2_validTypes array.
 */
function et2_checkType(_val, _type, _attr, _cname)
{
	if (typeof _attr == "undefined")
	{
		_attr = null;
	}

	function _err() {
		var res = et2_typeDefaults[_type];

		et2_debug("warn", "'" + _val + "' was not of specified _type '" + 
			_type + (_attr != null ? "' for attribute '" + _attr + "' " : "") +
			"and is now '" + res + "'");

		return res;
	}

	// If the type is "any" simply return the value again
	if (_type == "any")
	{
		return _val;
	}

	// If the type is boolean, check whether the given value is exactly true or
	// false. Otherwise check whether the value is the string "true" or "false".
	if (_type == "boolean")
	{
		if (_val === true || _val === false)
		{
			return _val;
		}

		if (typeof _val == "string")
		{
			var lcv = _val.toLowerCase();
			if (lcv === "true" || lcv === "false" || lcv === "")
			{
				return _val === "true";
			}
		}

		return _err();
	}

	if (_type == "js")
	{
		// Handle the default case
		if  (_val === null)
		{
			return null;
		}

		if (_val instanceof Function)
		{
			return _val;
		}

		// Create a new function containing the code
		if (typeof _val == "string")
		{
			if (_val !== "")
			{
				try
				{
					// Parse JS code properly
					_val = et2_js_pseudo_funcs(_val, _cname);
					if(_val == "1") return function() {return true;};

					// Check for remaining row data
					if(_val.indexOf("$") >= 0 || _val.indexOf("@") >= 0) 
					{
						// Still needs parsing
						return _val;
					}
					return new Function(_val); 
				}
				catch(e)
				{
					et2_debug("error", "Error while parsing JS event handler code", e,_val);
				}
			}

			return null;
		}

		return _err();
	}

	// Check whether the given value is of the type "string"
	if (_type == "string")
	{
		if (typeof _val == "string")
		{
			return _val;
		}

		return _err();
	}

	// Check whether the value is already a number, otherwise try to convert it
	// to one.
	if (_type == "float")
	{
		if (typeof _val == "number")
		{
			return _val;
		}

		if (!isNaN(_val))
		{
			return parseFloat(_val);
		}

		return _err();
	}

	// Check whether the value is an integer by comparing the result of
	// parseInt(_val) to the value itself.
	if (_type == "integer")
	{
		if (parseInt(_val) == _val)
		{
			return parseInt(_val);
		}

		return _err();
	}

	// Parse the given dimension value
	if (_type == "dimension")
	{
		// Case 1: The value is "auto"
		if (_val == "auto")
		{
			return _val;
		}

		// Case 2: The value is simply a number, attach "px"
		if (!isNaN(_val))
		{
			return parseFloat(_val) + "px";
		}

		// Case 3: The value is already a valid css pixel value or a percentage
		if (typeof _val == "string" && 
		   ((_val.indexOf("px") == _val.length - 2 && !isNaN(_val.split("px")[0])) ||
		   (_val.indexOf("%") == _val.length - 1 && !isNaN(_val.split("%")[0]))))
		{
			return _val;
		}

		return _err();
	}

	// We should never come here
	throw("Invalid type identifier supplied.");
}

/**
 * If et2_no_init is set as default value, the initAttributes function will not
 * try to initialize the attribute with the default value.
 */
var et2_no_init = new Object();

/**
 * Validates the given attribute with the given id. The validation checks for
 * the existance of a human name, a description, a type and a default value.
 * If the human name defaults to the given id, the description defaults to an
 * empty string, the type defaults to any and the default to the corresponding
 * type default.
 */
function et2_validateAttrib(_id, _attrib)
{
	// Default ignore to false.
	if (typeof _attrib["ignore"] == "undefined")
	{
		_attrib["ignore"] = false
	}

	// Break if "ignore" is set to true.
	if (_attrib.ignore)
	{
		return;
	}

	if (typeof _attrib["name"] == "undefined")
	{
		_attrib["name"] = _id;
		et2_debug("log", "Human name ('name'-Field) for attribute '" +
			_id + "' has not been supplied, set to '" + _id + "'");
console.debug(_attrib);
	}

	if (typeof _attrib["description"] == "undefined")
	{
		_attrib["description"] = "";
		et2_debug("log", "Description for attribute '" +
			_id + "' has not been supplied");
	}

	if (typeof _attrib["type"] == "undefined")
	{
		_attrib["type"] = "any";
	}
	else
	{
		if (et2_validTypes.indexOf(_attrib["type"]) < 0)
		{
			et2_debug("error", "Invalid type for attribute '" + _id + 
			    "' supplied.");
		}
	}

	// Set the defaults
	if (typeof _attrib["default"] == "undefined")
	{
		_attrib["default"] = et2_typeDefaults[_attrib["type"]];
	}
}

/**
 * Equivalent to the PHP array_values function
 */
function et2_arrayValues(_arr)
{
	var result = [];
	for (var key in _arr)
	{
		if (parseInt(key) == key)
		{
			result.push(_arr[key]);
		}
	}

	return result;
}

/**
 * Equivalent to the PHP array_keys function
 */
function et2_arrayKeys(_arr)
{
	var result = [];
	for (var key in _arr)
	{
		result.push(key);
	}

	return result;
}

function et2_arrayIntKeys(_arr)
{
	var result = [];
	for (var key in _arr)
	{
		result.push(parseInt(key));
	}

	return result;
}


/**
 * Equivalent to the PHP substr function, partly take from phpjs, licensed under
 * the GPL.
 */
function et2_substr (str, start, len) {
	var end = str.length;

	if (start < 0)
	{
		start += end;
	}
	end = typeof len === 'undefined' ? end : (len < 0 ? len + end : len + start);

	return start >= str.length || start < 0 || start > end ? "" : str.slice(start, end);
}

/**
 * Split a $delimiter-separated options string, which can contain parts with
 * delimiters enclosed in $enclosure. Ported from class.boetemplate.inc.php
 *
 * Examples:
 * - et2_csvSplit('"1,2,3",2,3') === array('1,2,3','2','3')
 * - et2_csvSplit('1,2,3',2) === array('1','2,3')
 * - et2_csvSplit('"1,2,3",2,3',2) === array('1,2,3','2,3')
 * - et2_csvSplit('"a""b,c",d') === array('a"b,c','d')	// to escape enclosures double them!
 *
 * @param string _str
 * @param int _num=null in how many parts to split maximal, parts over this
 * 	number end up (unseparated) in the last part
 * @param string _delimiter=','
 * @param string _enclosure='"'
 * @return array
 */
function et2_csvSplit(_str, _num, _delimiter, _enclosure)
{
	// Default the parameters
	if (typeof _str == "undefined")
	{
		_str = "";
	}
	if (typeof _num == "undefined")
	{
		_num = null;
	}

	if (typeof _delimiter == "undefined")
	{
		_delimiter = ",";
	}

	if (typeof _enclosure == "undefined")
	{
		_enclosure = '"';
	}

	// If the _enclosure string does not occur in the string, simply use the
	// split function
	if (_str.indexOf(_enclosure) == -1)
	{
		return _num === null ? _str.split(_delimiter) :
			_str.split(_delimiter, _num);
	}

	// Split the string at the delimiter and join it again, when a enclosure is
	// found at the beginning/end of a part
	var parts = _str.split(_delimiter); 
	for (var n = 0; typeof parts[n] != "undefined"; n++)
	{
		var part = parts[n];

		if (part.charAt(0) === _enclosure)
		{
			var m = n;
			while (typeof parts[m + 1] != "undefined" && parts[n].substr(-1) !== _enclosure)
			{
				parts[n] += _delimiter + parts[++m];
				delete(parts[m]);
			}
			parts[n] = et2_substr(parts[n].replace(
				new RegExp(_enclosure + _enclosure, 'g'), _enclosure), 1 , -1);
			n = m;
		}
	}

	// Rebuild the array index
	parts = et2_arrayValues(parts);

	// Limit the parts to the given number
	if (_num !== null && _num > 0 && _num < parts.length && parts.length > 0)
	{
		parts[_num - 1] = parts.slice(_num - 1, parts.length).join(_delimiter);
		parts = parts.slice(0, _num);
	}

	return parts;
}

/**
 * Parses the given string and returns an array marking parts which are URLs
 */
function et2_activateLinks(_content)
{
	var _match = false;
	var arr = [];

	function _splitPush(_matches, _proc)
	{
		if (_matches)
		{
			// We had a match
			_match = true;

			// Replace "undefined" with ""
			for (var i = 1; i < _matches.length; i++)
			{
				if (typeof _matches[i] == "undefined")
				{
					_matches[i] = "";
				}
			}

			// Split the content string at the given position
			var splitted = _content.split(_matches[0], 2);

			// Push the not-matched part
			if (splitted[0])
			{
				// activate the links of the left string
				arr = arr.concat(et2_activateLinks(splitted[0]));
			}

			// Call the callback function which converts the matches into an object
			// and appends it to the string
			_proc(_matches);

			// Set the new working string to the right part
			_content = splitted[1];
		}
	}

	var mail_regExp = /mailto:([a-z0-9._-]+)@([a-z0-9_-]+)\.([a-z0-9._-]+)/i;

	//  First match things beginning with http:// (or other protocols)
	var protocol = '(http:\\/\\/|(ftp:\\/\\/|https:\\/\\/))';	// only http:// gets removed, other protocolls are shown
	var domain = '([\\w-]+\\.[\\w-.]+)';
	var subdir = '([\\w\\-\\.,@?^=%&;:\\/~\\+#]*[\\w\\-\\@?^=%&\\/~\\+#])?';
	var http_regExp = new RegExp(protocol + domain + subdir, 'i');

	//  Now match things beginning with www.
	var domain = 'www(\\.[\\w-.]+)';
	var subdir = '([\\w\\-\\.,@?^=%&:\\/~\\+#]*[\\w\\-\\@?^=%&\\/~\\+#])?';
	var www_regExp = new RegExp(domain + subdir, 'i');

	do {
		_match = false;

		// Abort if the remaining length of _content is smaller than 20 for
		// performance reasons
		if (!_content)
		{
			break;
		}

		// No need make emailaddress spam-save, as it gets dynamically created
		_splitPush(_content.match(mail_regExp), function(_matches) {
			arr.push({
				"href": _matches[0],
				"text": _matches[1] + "@" + _matches[2] + "." + _matches[3]
			});
		});

		// Create hrefs for links starting with "http://"
		_splitPush(_content.match(http_regExp), function(_matches) {
			arr.push({
				"href": _matches[0],
				"text": _matches[2] + _matches[3] + _matches[4]
			});
		});

		// Create hrefs for links starting with "www."
		_splitPush(_content.match(www_regExp), function(_matches) {
			arr.push({
				"href": "http://" + _matches[0],
				"text": _matches[0]
			});
		});
	} while (_match)

	arr.push(_content);

	return arr;
}

/**
 * Inserts the structure generated by et2_activateLinks into the given DOM-Node
 */
function et2_insertLinkText(_text, _node, _target)
{
	if(!_node) 
	{
		et2_debug("warn", "et2_insertLinkText called without node", _text, _node, _target);
		return;
	}

	// Clear the node
	for (var i = _node.childNodes.length - 1; i >= 0; i--)
	{
		_node.removeChild(_node.childNodes[i]);
	}

	for (var i = 0; i < _text.length; i++)
	{
		var s = _text[i];

		if (typeof s == "string" || typeof s == "number")
		{
			_node.appendChild(document.createTextNode(s));
		}
		else
		{
			if(!s.href)
			{
				et2_debug("warn", "et2_activateLinks gave bad data", s, _node, _target);
				s.href = "";
			}
			var a = $j(document.createElement("a"))
				.attr("href", s.href)
				.text(s.text ? s.text : "-"+egw.lang("missing")+"-");

			if (typeof _target != "undefined" && _target && _target != "_self")
			{
				a.attr("target", _target);
			}

			a.appendTo(_node);
		}
	}
}

/**
 * Creates a copy of the given object (non recursive)
 */
function et2_cloneObject(_obj)
{
	var result = {};

	for (var key in _obj)
	{
		result[key] = _obj[key];
	}

	return result;
}

/**
 * Returns true if the given array of nodes or their children contains the given
 * child node.
 */
function et2_hasChild(_nodes, _child)
{
	for (var i = 0; i < _nodes.length; i++)
	{
		if (_nodes[i] == _child)
		{
			return true;
		}
		else if (_nodes[i].childNodes)
		{
			var res = et2_hasChild(_nodes[i].childNodes, _child);

			if (res)
			{
				return true;
			}
		}
	}

	return false;
}

/**
 * Generates a localy unique id and returns it
 */
var _et2_uniqueId = 0;

function et2_uniqueId()
{
	return _et2_uniqueId++;
}

/**
 * Functions to work with ranges and range intersection (used in the dataview)
 */

/**
 * Common functions used in most view classes
 */

/**
 * Returns an "range" object with the given top position and height
 */
function et2_range(_top, _height)
{
	return {
		"top": _top,
		"bottom": _top + _height
	}
}

/**
 * Returns an "area" object with the given top- and bottom position
 */
function et2_bounds(_top, _bottom)
{
	return {
		"top": _top,
		"bottom": _bottom
	}
}

/**
 * Returns whether two range objects intersect each other
 */
function et2_rangeIntersect(_ar1, _ar2)
{
	return ! (_ar1.bottom < _ar2.top || _ar1.top > _ar2.bottom);
}

/**
 * Returns whether two ranges intersect (result = 0) or their relative position
 * to each other (used to do a binary search inside a list of sorted range objects).
 */
function et2_rangeIntersectDir(_ar1, _ar2)
{
	if (_ar1.bottom < _ar2.top)
	{
		return -1;
	}
	if (_ar1.top > _ar2.bottom)
	{
		return 1;
	}
	return 0;
}

