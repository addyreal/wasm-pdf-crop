#include <iostream>

int main(void)
{
	std::cout << "Waiting for input..." << std::endl;

	return 0;
}

extern "C"
{
	void somefunction()
	{
		return;
	}
}