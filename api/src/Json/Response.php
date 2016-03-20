<?php
/**
 * EGroupware API: JSON - Contains functions and classes for doing JSON requests.
 *
 * @link http://www.egroupware.org
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package api
 * @subpackage json
 * @author Andreas Stoeckel <as@stylite.de>
 * @author Ralf Becker <ralfbecker@outdoor-training.de>
 * @version $Id$
 */

namespace EGroupware\Api\Json;

use EGroupware\Api;

/**
 * Class used to send ajax responses
 */
class Response extends Msg
{
	/**
	 * A response can only contain one generic data part.
	 * This variable is used to store, whether a data part had already been added to the response.
	 *
	 * @var boolean
	 */
	private $hasData = false;

	/**
	 * Array containing all beforeSendData callbacks
	 */
	protected $beforeSendDataProcs = array();

	/**
	 * Holds the actual response data which is then encoded to JSON
	 * once the "getJSON" function is called
	 *
	 * @var array
	 */
	protected $responseArray = array();

	/**
	 * Holding instance of class for singelton Response::get()
	 *
	 * @var Response
	 */
	private static $response = null;

	/**
	 * Force use of singleton: $response = Response::get();
	 */
	protected function __construct()
	{

	}

	/**
	 * Singelton for class
	 *
	 * @return Response
	 */
	public static function get()
	{
		if (!isset(self::$response))
		{
			self::$response = new Response();
			self::sendHeader();
		}
		return self::$response;
	}

	public static function isJSONResponse()
	{
		return isset(self::$response);
	}

	/**
	 * Do we have a JSON response to send back
	 *
	 * @return boolean
	 */
	public function haveJSONResponse()
	{
		return $this->responseArray || $this->beforeSendDataProcs;
	}

	/**
	 * Private function used to send the HTTP header of the JSON response
	 */
	private static function sendHeader()
	{
		$file = $line = null;
		if (headers_sent($file, $line))
		{
			error_log(__METHOD__."() header already sent by $file line $line: ".function_backtrace());
		}
		else
		{
			//Send the character encoding header
			header('content-type: application/json; charset='.Api\Translation::charset());
		}
	}

	/**
	 * Private function which is used to send the result via HTTP
	 */
	public static function sendResult()
	{
		$inst = self::get();

		//Call each attached before send data proc
		foreach ($inst->beforeSendDataProcs as $proc)
		{
			call_user_func_array($proc['proc'], $proc['params']);
		}

		// check if application made some direct output
		if (($output = ob_get_clean()))
		{
			if (!$inst->haveJSONResponse())
			{
				error_log(__METHOD__."() adding output with inst->addGeneric('html', '$output')");
				$inst->addGeneric('html', $output);
			}
			else
			{
				$inst->alert('Application echoed something', $output);
			}
		}

		echo $inst->getJSON();
		$inst->initResponseArray();
	}

	/**
	 * Return json response data, after running beforeSendDataProcs
	 *
	 * Used to send json response with etemplate data in GET request
	 *
	 * @return array responseArray
	 */
	public static function returnResult()
	{
		$inst = self::get();

		//Call each attached before send data proc
		foreach ($inst->beforeSendDataProcs as $proc)
		{
			call_user_func_array($proc['proc'], $proc['params']);
		}
		return $inst->initResponseArray();
	}

	/**
	 * xAjax compatibility function
	 *
	 * @deprecated output is send by egw::__destruct()
	 */
	public function printOutput()
	{
		// do nothing, as output is triggered by egw::__destruct()
	}

	/**
	 * Adds any type of data to the message
	 *
	 * @param string $key
	 * @param mixed $data
	 */
	protected function addGeneric($key, $data)
	{
		self::get()->responseArray[] = array(
			'type' => $key,
			'data' => $data,
		);
	}

	/**
	 * Init responseArray
	 *
	 * @param array $arr
	 * @return array previous content
	 */
	public function initResponseArray()
	{
		$return = $this->responseArray;
		$this->responseArray = $this->beforeSendDataProcs = array();
		$this->hasData = false;
		return $return;
	}


	/**
	 * Adds a "data" response to the json response.
	 *
	 * This function may only be called once for a single JSON response object.
	 *
	 * @param object|array|string $data can be of any data type and will be added JSON Encoded to your response.
	 */
	public function data($data)
	{
		/* Only allow adding the data response once */
		$inst = self::get();
		if (!$inst->hasData)
		{
			$inst->addGeneric('data', $data);
			$inst->hasData = true;
		}
		else
		{
			throw new Exception("Adding more than one data response to a JSON response is not allowed.");
		}
	}

	/**
	 * Returns the actual JSON code generated by calling the above "add" function.
	 *
	 * @return string
	 */
	public function getJSON()
	{
		$inst = self::get();

		/* Wrap the result array into a parent "response" Object */
		$res = array('response' => $inst->responseArray);

		return self::json_encode($res);	//PHP5.3+, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
	}

	/**
	 * More fault-tollerant version of json_encode removing everything that does not json_encode eg. because not utf-8
	 *
	 * @param mixed $var
	 * @return string
	 */
	public static function json_encode($var)
	{
		$ret = json_encode($var);

		if ($ret === false && ($err = json_last_error()))
		{
			static $json_err2str = array(
	        	JSON_ERROR_NONE => 'No errors',
	        	JSON_ERROR_DEPTH => 'Maximum stack depth exceeded',
	        	JSON_ERROR_STATE_MISMATCH => 'Underflow or the modes mismatch',
	        	JSON_ERROR_CTRL_CHAR => 'Unexpected control character found',
	        	JSON_ERROR_SYNTAX => 'Syntax error, malformed JSON',
	        	JSON_ERROR_UTF8 => 'Malformed UTF-8 characters, possibly incorrectly encoded',
	        );
			error_log(__METHOD__.'('.array2string($var).') json_last_error()='.$err.'='.$json_err2str[$err]);

			if (($var = self::fix_content($var)))
			{
				return self::json_encode($var);
			}
		}
		return $ret;
	}

	/**
	 * Set everything in $var to null, that does not json_encode, eg. because no valid utf-8
	 *
	 * @param midex $var
	 * @param string $prefix =''
	 * @return mixed
	 */
	public static function fix_content($var, $prefix='')
	{
		if (json_encode($var) !== false) return $var;

		if (is_scalar($var))
		{
			error_log(__METHOD__."() json_encode($prefix='$var') === false --> setting it to null");
			$var = null;
		}
		else
		{
			foreach($var as $name => &$value)
			{
				$value = self::fix_content($value, $prefix ? $prefix.'['.$name.']' : $name);
			}
		}
		return $var;
	}

	/**
	 * Function which can be used to add an event listener callback function to
	 * the "beforeSendData" callback. This callback might be used to add a response
	 * which always has to be added after all other responses.
	 * @param callback Callback function or method which should be called before the response gets sent
	 * @param mixed n Optional parameters which get passed to the callback function.
	 */
	public function addBeforeSendDataCallback($proc)
	{
		//Get the current instance
		$inst = self::get();

		//Get all parameters passed to the function and delete the first one
		$params = func_get_args();
		array_shift($params);

		$inst->beforeSendDataProcs[] = array(
			'proc' => $proc,
			'params' => $params
		);
	}
}
